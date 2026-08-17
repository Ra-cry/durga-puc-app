import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import PucRecord from '@/models/PucRecord';
import { read, utils } from 'xlsx';
import {
  computeValidTill,
  validateVehicleNo,
  parseISTDate,
  nowIST,
} from '@/lib/pucHelpers';

interface ImportRow {
  'Vehicle No'?: string;
  'BS Stage'?: string;
  Fuel?: string;
  'Customer Name'?: string;
  'Customer Phone'?: string;
  Agent?: string;
  'Issued Date'?: string;
  [key: string]: string | undefined;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: ImportRow[] = utils.sheet_to_json(sheet);

    const validRecords = [];
    const skipped: Array<{ row: number; reason: string }> = [];

    const VALID_BS_STAGES = ['BS1', 'BS2', 'BS3', 'BS4', 'BS6'];
    const VALID_FUELS = ['Diesel', 'Petrol', 'Gas'];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed, row 1 is headers

      const vehicleNo = row['Vehicle No']?.toString().trim().toUpperCase();
      const bsStage = row['BS Stage']?.toString().trim().toUpperCase();
      const fuel = row['Fuel']?.toString().trim();
      const customerName = row['Customer Name']?.toString().trim();
      const customerPhone = row['Customer Phone']?.toString().trim().replace(/\s/g, '');
      const agent = row['Agent']?.toString().trim() || null;
      const issuedDateStr = row['Issued Date']?.toString().trim();

      // Validations
      if (!vehicleNo) {
        skipped.push({ row: rowNum, reason: 'Missing Vehicle No' });
        continue;
      }
      if (!validateVehicleNo(vehicleNo)) {
        skipped.push({ row: rowNum, reason: `Invalid vehicle number: ${vehicleNo}` });
        continue;
      }
      if (!bsStage || !VALID_BS_STAGES.includes(bsStage)) {
        skipped.push({ row: rowNum, reason: `Invalid BS Stage: ${bsStage}` });
        continue;
      }
      if (!fuel || !VALID_FUELS.includes(fuel)) {
        skipped.push({ row: rowNum, reason: `Invalid Fuel type: ${fuel}` });
        continue;
      }
      if (!customerName) {
        skipped.push({ row: rowNum, reason: 'Missing Customer Name' });
        continue;
      }
      if (!customerPhone || !/^\d{10}$/.test(customerPhone)) {
        skipped.push({ row: rowNum, reason: `Invalid phone: ${customerPhone}` });
        continue;
      }
      if (!issuedDateStr) {
        skipped.push({ row: rowNum, reason: 'Missing Issued Date' });
        continue;
      }

      const issuedAt = parseISTDate(issuedDateStr);
      if (!issuedAt) {
        skipped.push({ row: rowNum, reason: `Invalid date format: ${issuedDateStr} (use dd-mm-yyyy)` });
        continue;
      }

      const validTill = computeValidTill(issuedAt, bsStage);
      const now = nowIST();

      validRecords.push({
        vehicleNo,
        bsStage,
        fuelType: fuel,
        customerName,
        customerPhone,
        agent,
        issuedAt,
        validTill,
        status: validTill < now ? 'expired' : 'active',
        source: 'excel_import',
      });
    }

    let importedCount = 0;
    if (validRecords.length > 0) {
      const result = await PucRecord.insertMany(validRecords, { ordered: false });
      importedCount = result.length;
    }

    return NextResponse.json({
      imported: importedCount,
      skipped: skipped.length,
      skippedDetails: skipped,
    });
  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
