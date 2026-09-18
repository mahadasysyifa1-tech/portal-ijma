import { SyllabusUnit, DatabaseState } from '../types';

/**
 * Escapes a field for CSV format (RFC 4180)
 */
function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Robust CSV line tokenizer respecting quoted fields
 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const nextCh = text[i + 1];

    if (ch === '"') {
      if (insideQuotes && nextCh === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (ch === ',' && !insideQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((ch === '\r' || ch === '\n') && !insideQuotes) {
      if (ch === '\r' && nextCh === '\n') i++;
      currentRow.push(currentVal.trim());
      if (currentRow.some((field) => field.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += ch;
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function cleanHeaderKey(h: string): string {
  return h.toLowerCase().replace(/[\s_\-]/g, '');
}

/**
 * Parse Syllabus CSV per specification:
 * - mapel_id -> subject_code
 * - mapel_n -> order
 * - mtr -> title
 * - hal pertama -> page_start
 * - hal terakhir -> page_end
 * - pt -> part
 * - no -> no
 * - eno -> eno
 * Ignore all other source columns.
 * Sort by mapel_n per mapel_id to assign order — don't trust file row order.
 */
export function parseSyllabusCsv(
  csvText: string,
  subjects: { id: string; code: string }[],
  defaultSubjectId?: string
): { units: SyllabusUnit[]; errors: string[]; rowCount: number } {
  const errors: string[] = [];
  const rows = parseCsvRows(csvText);

  // Look up subjects by their CODE (e.g. "MATH101"), not their internal id.
  const codeToId = new Map(
    subjects.map((s) => [s.code.trim().toLowerCase(), s.id])
  );

  if (rows.length < 2) {
    return { units: [], errors: ['File CSV kosong atau tidak memiliki baris data.'], rowCount: 0 };
  }

  const rawHeaders = rows[0];
  const headerKeys = rawHeaders.map(cleanHeaderKey);

  // Find column indices
  const colSubjectId = headerKeys.findIndex((k) =>
    ['mapelid', 'subjectid', 'mapel', 'subject'].includes(k)
  );
  const colOrder = headerKeys.findIndex((k) =>
    ['mapeln', 'ordern', 'order', 'n', 'noorder', 'nomor'].includes(k)
  );
  const colTitle = headerKeys.findIndex((k) =>
    ['mtr', 'materi', 'title', 'judul', 'bab', 'topik'].includes(k)
  );
  const colPageStart = headerKeys.findIndex((k) =>
    ['halpertama', 'halawal', 'pagestart', 'startpage', 'hal1'].includes(k)
  );
  const colPageEnd = headerKeys.findIndex((k) =>
    ['halterakhir', 'halakhir', 'pageend', 'endpage', 'hal2'].includes(k)
  );
  const colPart = headerKeys.findIndex((k) =>
    ['pt', 'part', 'jilid', 'bagian', 'volume', 'vol'].includes(k)
  );
  const colNo = headerKeys.findIndex((k) =>
    ['no', 'startno', 'nounit', 'nount'].includes(k)
  );
  const colEno = headerKeys.findIndex((k) =>
    ['eno', 'endno', 'enounit', 'enount', 'akhir'].includes(k)
  );

  const rawParsedUnits: Array<{
    subject_id: string;
    raw_mapel_n: number;
    title: string;
    page_start: string | number;
    page_end: string | number;
    part: string | number;
    no: number;
    eno: number;
  }> = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0 || row.every((val) => val === '')) continue;

    let subjectId: string;
    if (colSubjectId !== -1 && row[colSubjectId]) {
      const rawCode = row[colSubjectId].trim();
      const resolvedId = codeToId.get(rawCode.toLowerCase());
      if (!resolvedId) {
        errors.push(`Baris ${r + 1}: Kode mapel "${rawCode}" tidak ditemukan di daftar Mata Pelajaran.`);
        continue;
      }
      subjectId = resolvedId;
    } else if (defaultSubjectId) {
      subjectId = defaultSubjectId;
    } else {
      errors.push(`Baris ${r + 1}: Kolom mapel_id tidak ditemukan atau kosong.`);
      continue;
    }

    const rawNStr = colOrder !== -1 ? row[colOrder] : '';
    const parsedN = parseFloat(rawNStr);
    const rawMapelN = isNaN(parsedN) ? r : parsedN;

    const title = (colTitle !== -1 ? row[colTitle] : '') || `Materi ${r}`;
    const pageStart = colPageStart !== -1 ? row[colPageStart] : '';
    const pageEnd = colPageEnd !== -1 ? row[colPageEnd] : '';
    const part = colPart !== -1 ? row[colPart] : '';

    const noVal = colNo !== -1 ? parseInt(row[colNo], 10) : NaN;
    const enoVal = colEno !== -1 ? parseInt(row[colEno], 10) : NaN;

    const safeNo = isNaN(noVal) ? r : noVal;
    const safeEno = isNaN(enoVal) ? safeNo : enoVal;

    rawParsedUnits.push({
      subject_id: subjectId.trim(),
      raw_mapel_n: rawMapelN,
      title: title.trim(),
      page_start: pageStart,
      page_end: pageEnd,
      part: part,
      no: safeNo,
      eno: safeEno
    });
  }

  // Group by mapel_id and sort by mapel_n per mapel_id to assign order — don't trust file row order
  const grouped = new Map<string, typeof rawParsedUnits>();
  for (const item of rawParsedUnits) {
    if (!grouped.has(item.subject_id)) {
      grouped.set(item.subject_id, []);
    }
    grouped.get(item.subject_id)!.push(item);
  }

  const finalUnits: SyllabusUnit[] = [];

  grouped.forEach((subjectItems, subId) => {
    // Sort strictly by mapel_n
    subjectItems.sort((a, b) => a.raw_mapel_n - b.raw_mapel_n);

    subjectItems.forEach((item, index) => {
      const assignedOrder = index + 1; // clean 1-based sequential order
      finalUnits.push({
        id: `unit-${subId}-${assignedOrder}`,
        subject_id: subId,
        order: assignedOrder,
        title: item.title,
        page_start: item.page_start,
        page_end: item.page_end,
        part: item.part,
        no: item.no,
        eno: item.eno
      });
    });
  });

  return {
    units: finalUnits,
    errors,
    rowCount: finalUnits.length
  };
}

/**
 * Generates sample CSV template for SyllabusUnit
 */
export function getSampleSyllabusCsv(subjectId: string = 'MT'): string {
  const headers = ['mapel_id', 'mapel_n', 'mtr', 'hal pertama', 'hal terakhir', 'pt', 'no', 'eno'];
  const sampleRows = [
    [subjectId, '1', 'Pengantar Aljabar & Persamaan Linear', '1', '14', '1', '1', '12'],
    [subjectId, '2', 'Sistem Pertidaksamaan Linear Dua Variabel', '15', '28', '1', '13', '25'],
    [subjectId, '3', 'Matriks & Operasi Determinan', '29', '44', '1', '26', '40'],
    [subjectId, '4', 'Vektor pada Dimensi Dua dan Tiga', '45', '60', '1', '41', '55'],
    [subjectId, '5', 'Fungsi Kuadrat & Grafik Parabola', '61', '78', '2', '56', '72'],
    [subjectId, '6', 'Trigonometri Dasar & Identitas Sudut', '79', '98', '2', '73', '90'],
    [subjectId, '7', 'Turunan Fungsi Aljabar', '99', '120', '2', '91', '110'],
    [subjectId, '8', 'Integral Tak Tentu & Luas Daerah', '121', '145', '2', '111', '130']
  ];

  return [headers.join(','), ...sampleRows.map((r) => r.map(escapeCsv).join(','))].join('\r\n');
}

/**
 * Export all syllabus units to CSV
 */
export function exportSyllabusUnitsToCsv(units: SyllabusUnit[], db?: DatabaseState): string {
  const headers = [
    'id',
    'mapel_id',
    'subject_name',
    'mapel_n',
    'mtr',
    'hal pertama',
    'hal terakhir',
    'pt',
    'no',
    'eno',
    'unit_weight'
  ];

  const subMap = new Map((db?.subjects || []).map((s) => [s.id, s.name]));

  const rows = units.map((u) => {
    const weight = Math.max(1, (u.eno || 0) - (u.no || 0) + 1);
    return [
      escapeCsv(u.id),
      escapeCsv(u.subject_id),
      escapeCsv(subMap.get(u.subject_id) || ''),
      escapeCsv(u.order),
      escapeCsv(u.title),
      escapeCsv(u.page_start),
      escapeCsv(u.page_end),
      escapeCsv(u.part),
      escapeCsv(u.no),
      escapeCsv(u.eno),
      escapeCsv(weight)
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

export const exportSyllabusToCsv = exportSyllabusUnitsToCsv;
