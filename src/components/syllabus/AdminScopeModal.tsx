import React, { useState, useMemo } from 'react';
import { X, Layers, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { DatabaseState, SyllabusUnit, SyllabusScope } from '../../types';
import { formatUnitDisplay, getScopedUnits } from '../../utils/pacingEngine';

interface AdminScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: DatabaseState;
  subjectId: string;
  classSectionId: string;
  onSaveScope: (scope: SyllabusScope | null) => void;
}

export const AdminScopeModal: React.FC<AdminScopeModalProps> = ({
  isOpen,
  onClose,
  db,
  subjectId,
  classSectionId,
  onSaveScope
}) => {
  if (!isOpen) return null;

  const subject = db.subjects.find((s) => s.id === subjectId);
  const classObj = db.classes.find((c) => c.id === classSectionId);

  // Filter to that subject's units only, ordered by order
  const subjectUnits = useMemo(() => {
    const units = db.syllabusUnits || [];
    return units
      .filter((u) => u.subject_id === subjectId)
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [db.syllabusUnits, subjectId]);

  // Existing scope for this (subject, class-section)
  const existingScope = useMemo(() => {
    const scopes = db.syllabusScopes || [];
    return scopes.find(
      (s) => s.subject_id === subjectId && s.class_section_id === classSectionId
    );
  }, [db.syllabusScopes, subjectId, classSectionId]);

  const [startUnitId, setStartUnitId] = useState<string>(
    existingScope?.start_unit_id || (subjectUnits[0]?.id ?? '')
  );
  const [endUnitId, setEndUnitId] = useState<string>(
    existingScope?.end_unit_id || (subjectUnits[subjectUnits.length - 1]?.id ?? '')
  );
  const [isFullSyllabusDefault, setIsFullSyllabusDefault] = useState<boolean>(!existingScope);

  const handleResetToDefault = () => {
    if (subjectUnits.length > 0) {
      setStartUnitId(subjectUnits[0].id);
      setEndUnitId(subjectUnits[subjectUnits.length - 1].id);
      setIsFullSyllabusDefault(true);
    }
  };

  const handleSave = () => {
    if (isFullSyllabusDefault) {
      // Remove scope override (default to full syllabus)
      onSaveScope(null);
    } else {
      const newScope: SyllabusScope = {
        id: existingScope?.id || `scope-${subjectId}-${classSectionId}`,
        subject_id: subjectId,
        class_section_id: classSectionId,
        start_unit_id: startUnitId,
        end_unit_id: endUnitId
      };
      onSaveScope(newScope);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Atur Batas Materi Silabus (Syllabus Scope)
              </h3>
              <p className="text-xs text-slate-500">
                {subject?.name || 'Mata Pelajaran'} • {classObj?.name || 'Kelas'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {subjectUnits.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Belum Ada Materi Silabus</p>
                <p className="mt-1 text-amber-700">
                  Mata pelajaran ini belum memiliki data bab materi/SyllabusUnit. Silakan impor data silabus melalui menu Basis Data Master terlebih dahulu.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Default status indicator */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Status Cakupan Silabus:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      isFullSyllabusDefault
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {isFullSyllabusDefault ? 'Full Syllabus (Bawaan Lengkap)' : 'Kustomisasi (Override)'}
                  </span>
                </div>
                <p className="text-slate-500 mt-1">
                  {isFullSyllabusDefault
                    ? 'Kelas ini menempuh seluruh bab materi silabus yang tersedia secara proporsional.'
                    : 'Kelas ini menempuh bab materi yang dibatasi khusus (start & end chapter).'}
                </p>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFullSyllabusDefault(true)}
                  className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    isFullSyllabusDefault
                      ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Gunakan Full Silabus
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullSyllabusDefault(false)}
                  className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    !isFullSyllabusDefault
                      ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Tentukan Batasan Khusus
                </button>
              </div>

              {/* Two Chapter Pickers: Start & End per specification */}
              {!isFullSyllabusDefault && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  {/* Start Picker */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mulai Dari Bab (Start Chapter):
                    </label>
                    <select
                      value={startUnitId}
                      onChange={(e) => setStartUnitId(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium"
                    >
                      {subjectUnits.map((u) => (
                        <option key={`start-${u.id}`} value={u.id}>
                          {formatUnitDisplay(u)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* End Picker */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Sampai Bab (End Chapter):
                    </label>
                    <select
                      value={endUnitId}
                      onChange={(e) => setEndUnitId(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium"
                    >
                      {subjectUnits.map((u) => (
                        <option key={`end-${u.id}`} value={u.id}>
                          {formatUnitDisplay(u)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <p className="text-[11px] text-slate-500 italic">
                    Format opsi: {'{part}/{page_start}: {title}'}. Pacing engine akan membagi bobot materi dalam rentang ini secara merata ke seluruh sesi terjadwal kelas ini.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Bawaan</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/80 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={subjectUnits.length === 0}
              className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Simpan Batasan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
