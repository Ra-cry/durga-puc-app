import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import PucRecord from '@/models/PucRecord';
import { read, utils } from 'xlsx';
import {
  computeValidTill,
  parseISTDate,
  nowIST,
} from '@/lib/pucHelpers';

// Relaxed vehicle number validation — handles real-world plates
// Supports: AP37CH01069 (5 digits), AP09AB1234 (4 digits), etc.
function validateVehicleNoRelaxed(vehicleNo: string): boolean {
  const cleaned = (vehicleNo || '').replace(/[\s-]/g, '').toUpperCase();
  // Standard: 2 letters + 1-2 digits + 1-3 letters + 3-5 digits
  return /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,5}$/.test(cleaned);
}

function getCol(row: Record<string, any>, ...keys: string[]): any {
  for (const key of keys) {
    // Exact match first
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
    // Case-insensitive match
    const lowerKey = key.toLowerCase();
    for (const rowKey of Object.keys(row)) {
      if (rowKey.toLowerCase().trim() === lowerKey) {
        if (row[rowKey] !== undefined && row[rowKey] !== null && row[rowKey] !== '') {
          return row[rowKey];
        }
      }
    }
  }
  return undefined;
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
    // cellDates: true converts Excel date serials to JS Date objects
    // raw: false converts everything to strings (fallback)
    const workbook = read(buffer, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // defval: '' ensures empty cells are included
    const rows: Record<string, any>[] = utils.sheet_to_json(sheet, {
      defval: '',
      blankrows: false,
    });

    if (rows.length === 0) {
      return NextResponse.json({
        imported: 0,
        skipped: 0,
        skippedDetails: [],
        warning: 'No rows found in the Excel file. Please check that your file has data rows below the header.',
      });
    }

    const validRecords: any[] = [];
    const skipped: Array<{ row: number; reason: string }> = [];

    const VALID_BS_STAGES = ['BS1', 'BS2', 'BS3', 'BS4', 'BS6'];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      // Skip totally empty rows
      const rowValues = Object.values(row).map((v) => String(v).trim()).filter(Boolean);
      if (rowValues.length === 0) continue;

      // Extract all fields with flexible column name matching
      const vehicleNoRaw = getCol(row,
        'Vehicle No', 'VehicleNo', 'vehicle no', 'vehicleno', 'Vehicle Number', 'Veh No', 'Reg No'
      );
      const vehicleNo = vehicleNoRaw
        ? String(vehicleNoRaw).replace(/[\s-]/g, '').toUpperCase()
        : '';

      const vehicleClass = String(
        getCol(row, 'Class', 'Vehicle Class', 'VehicleClass', 'Veh Class') || 'CAR'
      ).trim().toUpperCase();

      const bsStageRaw = getCol(row, 'BS Stage', 'BSStage', 'bs stage', 'bsstage', 'BS', 'Bs Stage');
      const bsStage = bsStageRaw
        ? String(bsStageRaw).trim().toUpperCase().replace(/\s+/g, '')
        : '';

      const rawFuel = getCol(row, 'Fuel', 'FuelType', 'Fuel Type', 'fuel', 'FUEL');
      const customerName = String(
        getCol(row, 'Customer Name', 'CustomerName', 'Name', 'customer name') || '—'
      ).trim();
      const customerPhoneRaw = getCol(row,
        'Customer Phone', 'CustomerPhone', 'Phone', 'Mobile', 'Mobile No', 'Phone No', 'customer phone'
      );
      const customerPhone = customerPhoneRaw
        ? String(customerPhoneRaw).replace(/\D/g, '')
        : '';

      const agentRaw = getCol(row, 'Agent', 'agent', 'Agent Name');
      const agent = agentRaw ? String(agentRaw).trim() : null;

      const issuedDateRaw = getCol(row,
        'Issued Date', 'IssuedDate', 'Date', 'issuedDate', 'issued_date', 'Issue Date', 'IssueDate'
      );

      // Validations
      if (!vehicleNo) {
        skipped.push({ row: rowNum, reason: 'Missing Vehicle No' });
        continue;
      }
      if (!validateVehicleNoRelaxed(vehicleNo)) {
        skipped.push({ row: rowNum, reason: `Invalid vehicle number format: "${vehicleNo}" (e.g. AP37CH01069)` });
        continue;
      }
      if (!bsStage || !VALID_BS_STAGES.includes(bsStage)) {
        skipped.push({ row: rowNum, reason: `Invalid BS Stage: "${bsStage}" (must be BS1/BS2/BS3/BS4/BS6)` });
        continue;
      }

      let fuel = 'Petrol';
      if (rawFuel) {
        const fUpper = String(rawFuel).toUpperCase().trim();
        if (fUpper === 'D' || fUpper.startsWith('DIESEL')) fuel = 'Diesel';
        else if (fUpper === 'G' || fUpper.startsWith('GAS') || fUpper.startsWith('CNG') || fUpper.startsWith('LPG')) fuel = 'Gas';
        else fuel = 'Petrol'; // P or Petrol or anything else → Petrol
      }

      if (!customerPhone || !/^\d{10}$/.test(customerPhone)) {
        skipped.push({ row: rowNum, reason: `Invalid phone: "${customerPhoneRaw}" — must be 10 digits` });
        continue;
      }

      if (issuedDateRaw === undefined || issuedDateRaw === null || String(issuedDateRaw).trim() === '') {
        skipped.push({ row: rowNum, reason: 'Missing Issued Date' });
        continue;
      }

      const issuedAt = parseISTDate(issuedDateRaw);
      if (!issuedAt) {
        skipped.push({ row: rowNum, reason: `Cannot parse date: "${issuedDateRaw}" — use dd-mm-yyyy` });
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
        agent: agent || null,
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
        } else if (err?.result?.nInserted) {
          importedCount = err.result.nInserted;
        } else {
          importedCount = validRecords.length;
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
    return NextResponse.json({ error: 'Import failed: ' + String(err) }, { status: 500 });
  }
}
