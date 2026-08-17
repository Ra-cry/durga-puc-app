import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import PucRecord from '@/models/PucRecord';
import { utils, write } from 'xlsx';
import { formatIST } from '@/lib/pucHelpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const type = searchParams.get('type') || 'old'; // 'old' | 'expired'

  try {
    await dbConnect();

    let query: Record<string, unknown> = {};

    if (type === 'expired') {
      if (startDate && endDate) {
        query = { validTill: { $gte: new Date(startDate), $lte: new Date(endDate) } };
      } else {
        query = { validTill: { $lt: new Date() } };
      }
    } else {
      if (startDate && endDate) {
        query = { issuedAt: { $gte: new Date(startDate), $lte: new Date(endDate) } };
      }
    }

    const records = await PucRecord.find(query).sort({ issuedAt: -1 }).lean();

    const sheetData = records.map((r) => ({
      'Vehicle No': r.vehicleNo,
      'BS Stage': r.bsStage,
      Fuel: r.fuelType,
      'Customer Name': r.customerName,
      'Customer Phone': r.customerPhone,
      Agent: r.agent || '',
      'Issued Date': formatIST(r.issuedAt),
      'Valid Till': formatIST(r.validTill),
      Status: new Date(r.validTill) < new Date() ? 'Expired' : 'Active',
    }));

    const worksheet = utils.json_to_sheet(sheetData);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'PUC Records');

    // Auto-size columns
    const colWidths = Object.keys(sheetData[0] || {}).map((key) => ({
      wch: Math.max(key.length, 15),
    }));
    worksheet['!cols'] = colWidths;

    const excelBuffer = write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const filename = `puc-records-${type}-${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
