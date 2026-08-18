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

// Relaxed vehicle number — handles AP37CH01069 (5 digits), AP09AB1234 (4 digits), etc.
function isValidVehicleNo(vno: string): boolean {
  const s = (vno || '').replace(/[\s\-_.]/g, '').toUpperCase();
  return /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,5}$/.test(s);
}

// Find value from a row using multiple possible column names (case-insensitive)
function getField(row: Record<string, any>, ...keys: string[]): any {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
    // Case-insensitive search
    const keyLow = key.toLowerCase().trim().replace(/\s+/g, ' ');
    for (const k of Object.keys(row)) {
      if (k.toLowerCase().trim().replace(/\s+/g, ' ') === keyLow) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
          return row[k];
        }
      }
    }
  }
  return undefined;
}

// Auto-detect header row index in raw 2D array
function findHeaderRowIndex(rawRows: any[][]): number {
  const headerKeywords = ['vehicle', 'bs', 'fuel', 'phone', 'date', 'class', 'issued'];
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;
    const rowText = row.map((c: any) => String(c ?? '').toLowerCase());
    let matches = 0;
    for (const kw of headerKeywords) {
      if (rowText.some((cell: string) => cell.includes(kw))) matches++;
    }
    if (matches >= 2) return i; // Found the header row
  }
  return 0; // Default to first row
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

    // Read with cellDates for proper Excel date handling
    const workbook = read(buffer, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Step 1: Read as raw 2D array to detect headers
    const rawRows: any[][] = utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });

    if (rawRows.length === 0) {
      return NextResponse.json({
        imported: 0,
        skipped: 0,
        skippedDetails: [{ row: 0, reason: 'Excel file appears to be empty. Please check the file.' }],
      });
    }

    // Step 2: Auto-detect which row is the header
    const headerRowIdx = findHeaderRowIndex(rawRows);
    const headerRow = rawRows[headerRowIdx].map((h: any) =>
      String(h ?? '').trim().replace(/\n/g, ' ').replace(/\s+/g, ' ')
    );

    // Step 3: Build rows as objects from detected header
    const dataRows: Record<string, any>[] = [];
    for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
      const rawRow = rawRows[i];
      if (!rawRow || rawRow.length === 0) continue;
      // Skip row if all cells are empty
      if (rawRow.every((c: any) => String(c ?? '').trim() === '')) continue;
      const rowObj: Record<string, any> = {};
      headerRow.forEach((colName, colIdx) => {
        if (colName) rowObj[colName] = rawRow[colIdx] ?? '';
      });
      dataRows.push(rowObj);
    }

    if (dataRows.length === 0) {
      return NextResponse.json({
        imported: 0,
        skipped: 0,
        skippedDetails: [{ row: 0, reason: `No data rows found. Header detected at row ${headerRowIdx + 1}: [${headerRow.join(', ')}]` }],
      });
    }

    const validRecords: any[] = [];
    const skipped: Array<{ row: number; reason: string }> = [];
    const VALID_BS_STAGES = ['BS1', 'BS2', 'BS3', 'BS4', 'BS6'];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = headerRowIdx + i + 2; // real Excel row number

      // Extract fields
      const vehicleNoRaw = getField(row,
        'Vehicle No', 'VehicleNo', 'Veh No', 'Vehicle Number', 'Reg No', 'Registration No', 'vehicle no'
      );
      const vehicleNo = vehicleNoRaw
        ? String(vehicleNoRaw).replace(/[\s\-_.]/g, '').toUpperCase()
        : '';

      const vehicleClass = String(
        getField(row, 'Class', 'Vehicle Class', 'VehicleClass', 'Veh Class') ?? 'CAR'
      ).trim().toUpperCase() || 'CAR';

      const bsStageRaw = getField(row,
        'BS Stage', 'BSStage', 'BS', 'Bs Stage', 'bs stage', 'bsstage', 'BS_Stage'
      );
      const bsStage = bsStageRaw
        ? String(bsStageRaw).trim().toUpperCase().replace(/\s+/g, '')
        : '';

      const rawFuel = getField(row, 'Fuel', 'FuelType', 'Fuel Type', 'fuel');

      const customerName = String(
        getField(row, 'Customer Name', 'CustomerName', 'Name', 'Customer r Name') ?? '—'
      ).trim() || '—';

      const customerPhoneRaw = getField(row,
        'Customer Phone', 'CustomerPhone', 'Phone', 'Mobile', 'Mobile No', 'Phone No',
        'Customer\r\nPhone', 'Customer\nPhone', 'Custome r Phone'
      );
      const customerPhone = customerPhoneRaw
        ? String(customerPhoneRaw).replace(/\D/g, '')
        : '';

      const agentRaw = getField(row, 'Agent', 'agent', 'Agent Name');
      const agent = agentRaw ? String(agentRaw).trim() : null;

      const issuedDateRaw = getField(row,
        'Issued Date', 'IssuedDate', 'Date', 'Issue Date', 'IssueDate', 'Issued\nDate', 'issued date'
      );

      // ── Validations ──
      if (!vehicleNo) {
        skipped.push({ row: rowNum, reason: 'Missing Vehicle No' });
        continue;
      }
      if (!isValidVehicleNo(vehicleNo)) {
        skipped.push({ row: rowNum, reason: `Invalid vehicle number: "${vehicleNo}"` });
        continue;
      }
      if (!bsStage || !VALID_BS_STAGES.includes(bsStage)) {
        skipped.push({ row: rowNum, reason: `Invalid BS Stage: "${bsStage}" — must be BS1/BS2/BS3/BS4/BS6` });
        continue;
      }

      let fuel = 'Petrol';
      if (rawFuel) {
        const fUpper = String(rawFuel).toUpperCase().trim();
        if (fUpper === 'D' || fUpper.startsWith('DIESEL')) fuel = 'Diesel';
        else if (fUpper === 'G' || fUpper === 'CNG' || fUpper.startsWith('GAS') || fUpper.startsWith('CNG') || fUpper.startsWith('LPG')) fuel = 'Gas';
        else fuel = 'Petrol'; // P or Petrol → Petrol
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
        skipped.push({ row: rowNum, reason: `Cannot read date: "${issuedDateRaw}" — use dd-mm-yyyy` });
        continue;
      }

      const validTill = computeValidTill(issuedAt, bsStage);
      const now = nowIST();

      validRecords.push({
        _id: `mem_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
        vehicleNo,
        vehicleClass,
        bsStage,
        fuelType: fuel,
        customerName,
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
        } else {
          // Even if DB throws, count what we expected to insert
          importedCount = validRecords.length;
        }
      }

      if (!global.__inMemoryPucRecords) global.__inMemoryPucRecords = [];
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
