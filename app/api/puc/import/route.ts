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

      const vehicleNo = (row['Vehicle No'] || row['VehicleNo'])?.toString().trim().toUpperCase();
      const vehicleClass = (row['Class'] || row['Vehicle Class'] || row['VehicleClass'] || 'CAR').toString().trim().toUpperCase();
      const bsStage = (row['BS Stage'] || row['BSStage'])?.toString().trim().toUpperCase();
      const rawFuel = (row['Fuel'] || row['FuelType'] || row['Fuel Type'])?.toString().trim();
      const customerName = (row['Customer Name'] || row['CustomerName'])?.toString().trim();
      const customerPhone = (row['Customer Phone'] || row['CustomerPhone'] || row['Phone'])?.toString().trim().replace(/\D/g, '');
      const agent = (row['Agent'] || '')?.toString().trim() || null;
      const issuedDateRaw = row['Issued Date'] || row['IssuedDate'] || row['Date'] || row['issuedDate'] || row['issued_date'];

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

      let fuel = 'Petrol';
      if (rawFuel) {
        const fUpper = rawFuel.toUpperCase();
        if (fUpper === 'D' || fUpper.startsWith('DIESEL')) fuel = 'Diesel';
        else if (fUpper === 'G' || fUpper.startsWith('GAS') || fUpper.startsWith('CNG') || fUpper.startsWith('LPG')) fuel = 'Gas';
        else fuel = 'Petrol';
      }

      if (!customerPhone || !/^\d{10}$/.test(customerPhone)) {
        skipped.push({ row: rowNum, reason: `Invalid phone: ${customerPhone}` });
        continue;
      }
      if (issuedDateRaw === undefined || issuedDateRaw === null || String(issuedDateRaw).trim() === '') {
        skipped.push({ row: rowNum, reason: 'Missing Issued Date' });
        continue;
      }

      const issuedAt = parseISTDate(issuedDateRaw);
      if (!issuedAt) {
        skipped.push({ row: rowNum, reason: `Invalid date format: ${issuedDateRaw} (use dd-mm-yyyy)` });
        continue;
      }

      const validTill = computeValidTill(issuedAt, bsStage);
      const now = nowIST();

      validRecords.push({
        _id: `mem_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
        vehicleNo,
        vehicleClass: vehicleClass || 'CAR',
        bsStage,
        fuelType: fuel,
        customerName: customerName || '—',
        customerPhone,
        agent,
        issuedAt,
        validTill,
        status: validTill < now ? 'expired' : 'active',
        source: 'excel_import',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    let importedCount = 0;
    if (validRecords.length > 0) {
      try {
        const result = await PucRecord.insertMany(validRecords, { ordered: false });
        importedCount = result.length;
      } catch (err: any) {
        if (err?.insertedDocs?.length) {
          importedCount = err.insertedDocs.length;
        }
      }

      if (!global.__inMemoryPucRecords) {
        global.__inMemoryPucRecords = [];
      }
      global.__inMemoryPucRecords.unshift(...validRecords);
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
