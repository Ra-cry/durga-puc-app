import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import PucRecord from '@/models/PucRecord';
import {
  startOfTodayIST,
  endOfTodayIST,
  computeValidTill,
  validateVehicleNo,
  sanitizeVehicleNo,
  parseISTDate,
  nowIST,
} from '@/lib/pucHelpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var __inMemoryPucRecords: any[] | undefined;
}

if (!global.__inMemoryPucRecords) {
  global.__inMemoryPucRecords = [];
}

// GET /api/puc - fetch records
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'today' | 'today_expired' | 'expired' | 'old' | 'search' | 'all'
  const search = searchParams.get('search');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '100');
  const skip = (page - 1) * limit;

  try {
    const conn = await dbConnect();
    const todayStart = startOfTodayIST();
    const todayEnd = endOfTodayIST();
    const now = nowIST();

    if (conn) {
      let query: Record<string, unknown> = {};
      let sortQuery: Record<string, 1 | -1> = { issuedAt: -1 };

      if (type === 'today') {
        query = { issuedAt: { $gte: todayStart, $lte: todayEnd } };
      } else if (type === 'today_expired') {
        query = { validTill: { $gte: todayStart, $lte: todayEnd } };
        sortQuery = { validTill: -1 };
      } else if (type === 'expired') {
        sortQuery = { validTill: -1 };
        if (startDate && endDate) {
          query = {
            validTill: {
              $gte: new Date(startDate),
              $lte: new Date(endDate),
            },
          };
        } else {
          query = { validTill: { $lt: now } };
        }
      } else if (type === 'old') {
        if (startDate && endDate) {
          query = { issuedAt: { $gte: new Date(startDate), $lte: new Date(endDate) } };
        }
      } else if (type === 'search' && search) {
        const searchTrim = search.trim();
        const searchClean = searchTrim.replace(/[\s-]/g, '');
        const searchDigits = searchTrim.replace(/\D/g, '');

        const orList: Record<string, unknown>[] = [
          { vehicleNo: { $regex: searchClean || searchTrim, $options: 'i' } },
          { vehicleClass: { $regex: searchTrim, $options: 'i' } },
          { customerName: { $regex: searchTrim, $options: 'i' } },
          { agent: { $regex: searchTrim, $options: 'i' } },
          { fuelType: { $regex: searchTrim, $options: 'i' } },
          { bsStage: { $regex: searchTrim, $options: 'i' } },
        ];
        if (searchDigits) {
          orList.push({ customerPhone: { $regex: searchDigits } });
        }
        query = { $or: orList };
      }

      const [records, total] = await Promise.all([
        PucRecord.find(query).sort(sortQuery).skip(skip).limit(limit).lean(),
        PucRecord.countDocuments(query),
      ]);

      const enriched = records.map((r) => {
        const isExp =
          new Date(r.validTill).getTime() <= now.getTime() ||
          (type === 'today_expired' && new Date(r.validTill).getTime() <= todayEnd.getTime()) ||
          (type === 'expired' && !startDate);
        return {
          ...r,
          vehicleClass: r.vehicleClass || 'CAR',
          status: isExp ? 'expired' : 'active',
        };
      });

      return NextResponse.json({ records: enriched, total, page, limit, dbConnected: true });
    }

    // In-memory fallback if MongoDB is not connected
    let memoryList = global.__inMemoryPucRecords || [];

    if (type === 'today') {
      memoryList = memoryList.filter((r) => {
        const d = new Date(r.issuedAt);
        return d >= todayStart && d <= todayEnd;
      });
      memoryList.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
    } else if (type === 'today_expired') {
      memoryList = memoryList.filter((r) => {
        const d = new Date(r.validTill);
        return d >= todayStart && d <= todayEnd;
      });
      memoryList.sort((a, b) => new Date(b.validTill).getTime() - new Date(a.validTill).getTime());
    } else if (type === 'expired') {
      if (startDate && endDate) {
        const s = new Date(startDate);
        const e = new Date(endDate);
        memoryList = memoryList.filter((r) => {
          const d = new Date(r.validTill);
          return d >= s && d <= e;
        });
      } else {
        memoryList = memoryList.filter((r) => new Date(r.validTill) < now);
      }
      memoryList.sort((a, b) => new Date(b.validTill).getTime() - new Date(a.validTill).getTime());
    } else if (type === 'old') {
      if (startDate && endDate) {
        const s = new Date(startDate);
        const e = new Date(endDate);
        memoryList = memoryList.filter((r) => {
          const d = new Date(r.issuedAt);
          return d >= s && d <= e;
        });
      }
      memoryList.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
    } else if (type === 'search' && search) {
      const term = search.trim().toLowerCase();
      const termClean = term.replace(/[\s-]/g, '');
      const termDigits = term.replace(/\D/g, '');
      memoryList = memoryList.filter((r) => {
        const vNo = (r.vehicleNo || '').toLowerCase();
        const vClass = (r.vehicleClass || '').toLowerCase();
        const cName = (r.customerName || '').toLowerCase();
        const cPhone = (r.customerPhone || '').replace(/\D/g, '');
        const ag = (r.agent || '').toLowerCase();
        const fuel = (r.fuelType || '').toLowerCase();
        const bs = (r.bsStage || '').toLowerCase();
        return (
          vNo.includes(term) ||
          vNo.replace(/[\s-]/g, '').includes(termClean) ||
          vClass.includes(term) ||
          cName.includes(term) ||
          (termDigits && cPhone.includes(termDigits)) ||
          ag.includes(term) ||
          fuel.includes(term) ||
          bs.includes(term)
        );
      });
      memoryList.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
    }

    const paginated = memoryList.slice(skip, skip + limit).map((r) => {
      const isExp =
        new Date(r.validTill).getTime() <= now.getTime() ||
        (type === 'today_expired' && new Date(r.validTill).getTime() <= todayEnd.getTime()) ||
        (type === 'expired' && !startDate);
      return {
        ...r,
        vehicleClass: r.vehicleClass || 'CAR',
        status: isExp ? 'expired' : 'active',
      };
    });

    return NextResponse.json({
      records: paginated,
      total: memoryList.length,
      page,
      limit,
      dbConnected: false,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch records';
    return NextResponse.json({ error: errorMsg, records: [], total: 0, page, limit }, { status: 500 });
  }
}

// POST /api/puc - create a new PUC record
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { vehicleNo, vehicleClass, bsStage, fuelType, customerName, customerPhone, agent, issuedDate } = body;

    // Validation
    if (!vehicleNo || !bsStage || !fuelType || !customerPhone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedVehicleNo = sanitizeVehicleNo(vehicleNo);
    if (!validateVehicleNo(normalizedVehicleNo)) {
      return NextResponse.json(
        { error: 'Invalid vehicle number format. Example: AP03AB1234' },
        { status: 400 }
      );
    }

    const cleanPhone = (customerPhone || '').replace(/\D/g, '');
    if (!/^\d{10}$/.test(cleanPhone)) {
      return NextResponse.json({ error: 'Phone number must be exactly 10 digits' }, { status: 400 });
    }

    let issuedAt: Date;
    if (issuedDate) {
      const parsed = parseISTDate(issuedDate);
      issuedAt = parsed || new Date(issuedDate);
    } else {
      issuedAt = nowIST();
    }

    if (isNaN(issuedAt.getTime())) {
      issuedAt = nowIST();
    }

    const validTill = computeValidTill(issuedAt, bsStage);
    const now = nowIST();
    const status = validTill.getTime() < now.getTime() ? 'expired' : 'active';
    const finalVehicleClass = (vehicleClass || 'CAR').trim().toUpperCase();

    const recordData = {
      _id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      vehicleNo: normalizedVehicleNo,
      vehicleClass: finalVehicleClass,
      bsStage,
      fuelType: fuelType.trim(),
      customerName: customerName?.trim() || '—',
      customerPhone: cleanPhone,
      agent: agent?.trim() || null,
      issuedAt,
      validTill,
      status,
      source: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const conn = await dbConnect();
    let savedRecord = recordData;

    if (conn) {
      try {
        const doc = await PucRecord.create({
          vehicleNo: normalizedVehicleNo,
          vehicleClass: finalVehicleClass,
          bsStage,
          fuelType: fuelType.trim(),
          customerName: customerName?.trim() || '—',
          customerPhone: cleanPhone,
          agent: agent?.trim() || null,
          issuedAt,
          validTill,
          status,
          source: 'manual',
        });
        const docObj = doc.toObject();
        savedRecord = {
          ...docObj,
          _id: doc._id.toString(),
        } as any;
      } catch (e: unknown) {
        console.warn('MongoDB save error, keeping in fallback store:', e);
      }
    }

    // Always record in in-memory list for instant availability
    if (!global.__inMemoryPucRecords) {
      global.__inMemoryPucRecords = [];
    }
    global.__inMemoryPucRecords.unshift(savedRecord);

    return NextResponse.json({ record: savedRecord }, { status: 201 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error creating record';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

// DELETE /api/puc - delete a record by ID
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  let id = searchParams.get('id');

  if (!id) {
    try {
      const body = await request.json();
      id = body?.id;
    } catch {
      // ignore
    }
  }

  if (!id) {
    return NextResponse.json({ error: 'Record ID is required' }, { status: 400 });
  }

  try {
    const conn = await dbConnect();
    if (conn) {
      try {
        await PucRecord.findByIdAndDelete(id);
      } catch (err) {
        console.warn('Could not delete by direct ObjectId, trying string query:', err);
        await PucRecord.deleteOne({ _id: id });
      }
    }

    if (global.__inMemoryPucRecords) {
      global.__inMemoryPucRecords = global.__inMemoryPucRecords.filter(
        (r) => r._id?.toString() !== id
      );
    }

    return NextResponse.json({ success: true, message: 'Record deleted successfully' });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to delete record';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
