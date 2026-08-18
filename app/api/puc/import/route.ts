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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Relaxed vehicle number — handles AP37CH01069 (5 digits), AP09AB1234 (4 digits), etc.
function isValidVehicleNo(vno: string): boolean {
  const s = (vno || '').replace(/[\s\-_.]/g, '').toUpperCase();
  return /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,5}$/.test(s);
}

function normKey(s: any): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Auto-detect header row index in raw 2D array
function findHeaderRowIndex(rawRows: any[][]): number {
  const headerKeywords = ['vehicle', 'veh', 'reg', 'bs', 'fuel', 'phone', 'mobile', 'date', 'class', 'issued'];
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;
    let matches = 0;
    for (const cell of row) {
      const cellClean = normKey(cell);
      if (headerKeywords.some((kw) => cellClean.includes(kw))) matches++;
    }
    if (matches >= 2) return i;
  }
  return 0;
}

const COLUMN_PATTERNS: Record<string, string[]> = {
  vehicleNo: ['vehicleno', 'vehno', 'vehiclenumber', 'regno', 'registrationno', 'vehnumber', 'regnno', 'vehicle', 'veh'],
  vehicleClass: ['vehicleclass', 'vehclass', 'vehicletype', 'vehtype', 'class', 'category', 'type'],
  bsStage: ['bsstage', 'bs', 'stage', 'emissionnorm', 'norm'],
  fuel: ['fueltype', 'fuelname', 'fuel'],
  customerName: ['customername', 'ownername', 'custname', 'customer', 'owner', 'name'],
  customerPhone: ['customerphone', 'custphone', 'mobileno', 'phoneno', 'mobile', 'phone', 'contact', 'cellno', 'mobilenumber'],
  agent: ['agentname', 'agent', 'broker', 'reference', 'operator', 'user'],
  issuedDate: [
    'issueddate',
    'issuedat',
    'issued',
    'dateofissue',
    'pucdate',
    'certificatedate',
    'certdate',
    'docdate',
    'testdate',
    'fromdate',
    'validfrom',
    'dateissued',
    'issuedate',
    'issue',
    'date',
  ],
};

const VALID_BS_STAGES = new Set(['BS1', 'BS2', 'BS3', 'BS4', 'BS6']);

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const conn = await dbConnect();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();

    // Read with cellDates & dense mode for high performance
    const workbook = read(buffer, { type: 'array', cellDates: true, dense: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({
        imported: 0,
        skipped: 0,
        skippedDetails: [{ row: 0, reason: 'Excel workbook contains no sheets.' }],
      });
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows: any[][] = utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });

    if (!rawRows || rawRows.length === 0) {
      return NextResponse.json({
        imported: 0,
        skipped: 0,
        skippedDetails: [{ row: 0, reason: 'Excel file appears to be empty. Please check the file.' }],
      });
    }

    // Detect header row
    const headerRowIdx = findHeaderRowIndex(rawRows);
    const headerRow = rawRows[headerRowIdx] || [];

    // Pre-map column indices once
    const colMap: Record<string, number> = {
      vehicleNo: -1,
      vehicleClass: -1,
      bsStage: -1,
      fuel: -1,
      customerName: -1,
      customerPhone: -1,
      agent: -1,
      issuedDate: -1,
    };

    headerRow.forEach((h: any, colIdx: number) => {
      const clean = normKey(h);
      if (!clean) return;
      for (const [field, aliases] of Object.entries(COLUMN_PATTERNS)) {
        if (colMap[field] === -1 && aliases.some((a) => clean.includes(a))) {
          colMap[field] = colIdx;
          break;
        }
      }
    });

    const validRecords: any[] = [];
    const skipped: Array<{ row: number; reason: string }> = [];
    const seenInFile = new Set<string>();
    const now = nowIST();

    // Single-pass direct array iteration
    for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;
      // Skip if entire row is empty
      if (row.every((c: any) => c === '' || c === null || c === undefined)) continue;

      const rowNum = i + 1; // Real 1-indexed Excel row number

      // 1. Vehicle No
      const vehicleNoRaw = colMap.vehicleNo !== -1 ? row[colMap.vehicleNo] : '';
      const vehicleNo = vehicleNoRaw ? String(vehicleNoRaw).replace(/[\s\-_.]/g, '').toUpperCase() : '';

      if (!vehicleNo) {
        skipped.push({ row: rowNum, reason: 'Missing Vehicle No' });
        continue;
      }
      if (!isValidVehicleNo(vehicleNo)) {
        skipped.push({ row: rowNum, reason: `Invalid vehicle number: "${vehicleNo}"` });
        continue;
      }

      // 2. BS Stage
      const bsStageRaw = colMap.bsStage !== -1 ? row[colMap.bsStage] : '';
      const bsStage = bsStageRaw ? String(bsStageRaw).trim().toUpperCase().replace(/\s+/g, '') : '';
      if (!bsStage || !VALID_BS_STAGES.has(bsStage)) {
        skipped.push({ row: rowNum, reason: `Invalid BS Stage: "${bsStageRaw}" — must be BS1/BS2/BS3/BS4/BS6` });
        continue;
      }

      // 3. Fuel
      const rawFuel = colMap.fuel !== -1 ? row[colMap.fuel] : '';
      let fuel = 'Petrol';
      if (rawFuel) {
        const fUpper = String(rawFuel).toUpperCase().trim();
        if (fUpper === 'D' || fUpper.startsWith('DIESEL')) fuel = 'Diesel';
        else if (fUpper === 'G' || fUpper.startsWith('CNG') || fUpper.startsWith('GAS') || fUpper.startsWith('LPG')) fuel = 'Gas';
      }

      // 4. Customer Phone (optional)
      const customerPhoneRaw = colMap.customerPhone !== -1 ? row[colMap.customerPhone] : '';
      let customerPhone = '—';
      if (customerPhoneRaw !== undefined && customerPhoneRaw !== null && String(customerPhoneRaw).trim() !== '') {
        const digits = String(customerPhoneRaw).replace(/\D/g, '');
        if (digits.length >= 10) {
          customerPhone = digits.slice(-10);
        } else if (digits.length > 0) {
          customerPhone = digits;
        } else {
          customerPhone = String(customerPhoneRaw).trim() || '—';
        }
      }

      // 5. Issued Date
      const issuedDateRaw = colMap.issuedDate !== -1 ? row[colMap.issuedDate] : '';
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

      // Deduplication within the Excel file:
      // If vehicleNo + issuedAt + validTill are all identical, skip as duplicate.
      // If issue date or validity differs (e.g. renewals), allow it.
      const dupKey = `${vehicleNo}|${issuedAt.getTime()}|${validTill.getTime()}`;
      if (seenInFile.has(dupKey)) {
        skipped.push({ row: rowNum, reason: `Duplicate record in file for ${vehicleNo} (identical issue & validity dates)` });
        continue;
      }
      seenInFile.add(dupKey);

      // 6. Other optional fields
      const vehicleClassRaw = colMap.vehicleClass !== -1 ? row[colMap.vehicleClass] : '';
      const vehicleClass = vehicleClassRaw ? String(vehicleClassRaw).trim().toUpperCase() || 'CAR' : 'CAR';

      const customerNameRaw = colMap.customerName !== -1 ? row[colMap.customerName] : '';
      const customerName = customerNameRaw ? String(customerNameRaw).trim() || '—' : '—';

      const agentRaw = colMap.agent !== -1 ? row[colMap.agent] : '';
      const agent = agentRaw ? String(agentRaw).trim() : null;

      const isExpired = validTill.getTime() < now.getTime();

      validRecords.push({
        vehicleNo,
        vehicleClass,
        bsStage,
        fuelType: fuel,
        customerName,
        customerPhone,
        agent: agent || null,
        issuedAt,
        validTill,
        status: isExpired ? 'expired' : 'active',
        source: 'excel_import',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    let importedCount = 0;

    if (validRecords.length > 0) {
      // Deduplicate against existing database records & in-memory store
      const existingKeySet = new Set<string>();

      if (conn) {
        try {
          const uniqueVehicles = Array.from(new Set(validRecords.map((r) => r.vehicleNo)));
          const existingDocs = await PucRecord.find(
            { vehicleNo: { $in: uniqueVehicles } },
            { vehicleNo: 1, issuedAt: 1, validTill: 1 }
          ).lean();

          for (const doc of existingDocs) {
            existingKeySet.add(
              `${doc.vehicleNo}|${new Date(doc.issuedAt).getTime()}|${new Date(doc.validTill).getTime()}`
            );
          }
        } catch (e) {
          console.warn('[IMPORT] Could not pre-check DB duplicates:', e);
        }
      }

      if (global.__inMemoryPucRecords) {
        for (const doc of global.__inMemoryPucRecords) {
          existingKeySet.add(
            `${doc.vehicleNo}|${new Date(doc.issuedAt).getTime()}|${new Date(doc.validTill).getTime()}`
          );
        }
      }

      const recordsToInsert = validRecords.filter((r) => {
        const k = `${r.vehicleNo}|${r.issuedAt.getTime()}|${r.validTill.getTime()}`;
        return !existingKeySet.has(k);
      });

      const duplicateDbCount = validRecords.length - recordsToInsert.length;
      if (duplicateDbCount > 0) {
        skipped.push({
          row: 0,
          reason: `${duplicateDbCount} record(s) already exist in database with identical dates and were not re-imported.`,
        });
      }

      if (recordsToInsert.length > 0) {
        if (conn) {
          try {
            // Native high-speed collection batch insert in chunks of 2,500
            const BATCH_SIZE = 2500;
            for (let b = 0; b < recordsToInsert.length; b += BATCH_SIZE) {
              const chunk = recordsToInsert.slice(b, b + BATCH_SIZE);
              const result = await PucRecord.collection.insertMany(chunk, { ordered: false });
              importedCount += result.insertedCount || chunk.length;
            }
          } catch (err: any) {
            console.error('[IMPORT] MongoDB insert error:', err?.message || err);
            if (err?.insertedCount !== undefined) {
              importedCount = err.insertedCount;
            } else if (err?.result?.nInserted !== undefined) {
              importedCount = err.result.nInserted;
            } else {
              importedCount = recordsToInsert.length;
            }
          }
        } else {
          importedCount = recordsToInsert.length;
        }

        // Always maintain fallback in-memory records
        if (!global.__inMemoryPucRecords) {
          global.__inMemoryPucRecords = [];
        }
        const memDocs = recordsToInsert.map((r, idx) => ({
          ...r,
          _id: `imp_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
        }));
        global.__inMemoryPucRecords = [...memDocs, ...global.__inMemoryPucRecords];
        if (global.__inMemoryPucRecords.length > 50000) {
          global.__inMemoryPucRecords = global.__inMemoryPucRecords.slice(0, 50000);
        }
      }
    }

    return NextResponse.json({
      imported: importedCount,
      skipped: skipped.length,
      skippedDetails: skipped.slice(0, 100),
    });
  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json({ error: 'Import failed: ' + String(err) }, { status: 500 });
  }
}
