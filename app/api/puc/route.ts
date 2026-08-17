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
  nowIST,
} from '@/lib/pucHelpers';

// GET /api/puc - fetch records
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'today' | 'today_expired' | 'search' | 'all'
  const search = searchParams.get('search');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '100');
  const skip = (page - 1) * limit;

  try {
    await dbConnect();

    let query: Record<string, unknown> = {};
    const todayStart = startOfTodayIST();
    const todayEnd = endOfTodayIST();

    if (type === 'today') {
      query = { issuedAt: { $gte: todayStart, $lte: todayEnd } };
    } else if (type === 'today_expired') {
      query = { validTill: { $gte: todayStart, $lte: todayEnd } };
    } else if (type === 'expired') {
      query = { validTill: { $lt: todayEnd } };
      if (startDate && endDate) {
        query = { validTill: { $gte: new Date(startDate), $lte: new Date(endDate) } };
      }
    } else if (type === 'old') {
      if (startDate && endDate) {
        query = { issuedAt: { $gte: new Date(startDate), $lte: new Date(endDate) } };
      }
    } else if (type === 'search' && search) {
      query = { vehicleNo: { $regex: search.toUpperCase(), $options: 'i' } };
    }

    const [records, total] = await Promise.all([
      PucRecord.find(query).sort({ issuedAt: -1 }).skip(skip).limit(limit).lean(),
      PucRecord.countDocuments(query),
    ]);

    // Recompute status on read
    const now = nowIST();
    const enriched = records.map((r) => ({
      ...r,
      status: new Date(r.validTill) < now ? 'expired' : 'active',
    }));

    return NextResponse.json({ records: enriched, total, page, limit });
  } catch (err) {
    // Return empty results gracefully if DB connection is not configured or fails
    return NextResponse.json({ records: [], total: 0, page, limit, dbConnected: false });
  }
}

// POST /api/puc - create a new PUC record
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await dbConnect();

    const body = await request.json();
    const { vehicleNo, bsStage, fuelType, customerName, customerPhone, agent } = body;

    // Validation
    if (!vehicleNo || !bsStage || !fuelType || !customerName || !customerPhone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedVehicleNo = vehicleNo.trim().toUpperCase();
    if (!validateVehicleNo(normalizedVehicleNo)) {
      return NextResponse.json(
        { error: 'Invalid vehicle number format. Expected format: AP03AB1234' },
        { status: 400 }
      );
    }

    if (!/^\d{10}$/.test(customerPhone.trim())) {
      return NextResponse.json({ error: 'Phone number must be 10 digits' }, { status: 400 });
    }

    const issuedAt = nowIST();
    const validTill = computeValidTill(issuedAt, bsStage);

    const record = await PucRecord.create({
      vehicleNo: normalizedVehicleNo,
      bsStage,
      fuelType,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      agent: agent?.trim() || null,
      issuedAt,
      validTill,
      status: 'active',
      source: 'manual',
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: 'Database error. Please verify MongoDB connection.' },
      { status: 500 }
    );
  }
}
