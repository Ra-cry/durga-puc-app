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
  nowIST,
} from '@/lib/pucHelpers';

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

      if (type === 'today') {
        query = { issuedAt: { $gte: todayStart, $lte: todayEnd } };
      } else if (type === 'today_expired') {
        query = { validTill: { $gte: todayStart, $lte: todayEnd } };
      } else if (type === 'expired') {
        if (startDate && endDate) {
          query = { validTill: { $gte: new Date(startDate), $lte: new Date(endDate) } };
        } else {
          query = { validTill: { $lt: todayEnd } };
        }
      } else if (type === 'old') {
        if (startDate && endDate) {
          query = { issuedAt: { $gte: new Date(startDate), $lte: new Date(endDate) } };
        }
      } else if (type === 'search' && search) {
        const cleanSearch = sanitizeVehicleNo(search);
        query = { vehicleNo: { $regex: cleanSearch, $options: 'i' } };
      }

      const [records, total] = await Promise.all([
        PucRecord.find(query).sort({ issuedAt: -1 }).skip(skip).limit(limit).lean(),
        PucRecord.countDocuments(query),
      ]);

      const enriched = records.map((r) => ({
        ...r,
        status: new Date(r.validTill) < now ? 'expired' : 'active',
      }));

      return NextResponse.json({ records: enriched, total, page, limit, dbConnected: true });
    }

    // In-memory fallback if MongoDB is not connected
    let memoryList = global.__inMemoryPucRecords || [];

    if (type === 'today') {
      memoryList = memoryList.filter((r) => {
        const d = new Date(r.issuedAt);
        return d >= todayStart && d <= todayEnd;
      });
    } else if (type === 'today_expired') {
      memoryList = memoryList.filter((r) => {
        const d = new Date(r.validTill);
        return d >= todayStart && d <= todayEnd;
      });
    } else if (type === 'expired') {
      if (startDate && endDate) {
        const s = new Date(startDate);
        const e = new Date(endDate);
        memoryList = memoryList.filter((r) => {
          const d = new Date(r.validTill);
          return d >= s && d <= e;
        });
      } else {
        memoryList = memoryList.filter((r) => new Date(r.validTill) < todayEnd);
      }
    } else if (type === 'old') {
      if (startDate && endDate) {
        const s = new Date(startDate);
        const e = new Date(endDate);
        memoryList = memoryList.filter((r) => {
          const d = new Date(r.issuedAt);
          return d >= s && d <= e;
        });
      }
    } else if (type === 'search' && search) {
      const cleanSearch = sanitizeVehicleNo(search);
      memoryList = memoryList.filter((r) =>
        r.vehicleNo.toUpperCase().includes(cleanSearch)
      );
    }

    memoryList.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
    const paginated = memoryList.slice(skip, skip + limit).map((r) => ({
      ...r,
      status: new Date(r.validTill) < now ? 'expired' : 'active',
    }));

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
    const { vehicleNo, bsStage, fuelType, customerName, customerPhone, agent } = body;

    // Validation
    if (!vehicleNo || !bsStage || !fuelType || !customerName || !customerPhone) {
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

    const issuedAt = nowIST();
    const validTill = computeValidTill(issuedAt, bsStage);

    const recordData = {
      _id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      vehicleNo: normalizedVehicleNo,
      bsStage,
      fuelType,
      customerName: customerName.trim(),
      customerPhone: cleanPhone,
      agent: agent?.trim() || null,
      issuedAt,
      validTill,
      status: 'active',
      source: 'manual',
      createdAt: issuedAt,
      updatedAt: issuedAt,
    };

    const conn = await dbConnect();
    let savedRecord = recordData;

    if (conn) {
      try {
        const doc = await PucRecord.create({
          vehicleNo: normalizedVehicleNo,
          bsStage,
          fuelType,
          customerName: customerName.trim(),
          customerPhone: cleanPhone,
          agent: agent?.trim() || null,
          issuedAt,
          validTill,
          status: 'active',
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
