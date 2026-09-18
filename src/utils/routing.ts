import { ActiveTabType } from '../components/Header';
import { ViewerRole } from '../components/JournalView';
import { DatabaseState } from '../types';

export interface ParsedRoute {
  tab?: ActiveTabType;
  role?: ViewerRole;
  id?: string;
}

/**
 * Parse URL search parameters for tab, role, and entity id
 */
export function parseUrlRoute(db?: DatabaseState): ParsedRoute {
  try {
    const params = new URLSearchParams(window.location.search);

    let tab: ActiveTabType | undefined = undefined;
    const rawTab = params.get('tab') || params.get('page');
    if (rawTab) {
      const lower = rawTab.toLowerCase();
      if (lower === 'home' || lower === 'beranda') tab = 'home';
      else if (lower === 'studio' || lower === 'jadwal' || lower === 'schedule') tab = 'studio';
      else if (lower === 'kaldik') tab = 'kaldik';
      else if (lower === 'journal' || lower === 'jurnal') tab = 'journal';
      else if (lower === 'subjects' || lower === 'pelajaran') tab = 'subjects';
      else if (lower === 'teachers' || lower === 'guru') tab = 'teachers';
      else if (lower === 'conflicts' || lower === 'konflik') tab = 'conflicts';
      else if (lower === 'database' || lower === 'data') tab = 'database';
      else if (lower === 'export' || lower === 'ekspor' || lower === 'export-import') tab = 'export-import';
    }

    let role: ViewerRole | undefined = undefined;
    let id: string | undefined = undefined;

    const classParam = params.get('class') || params.get('kelas');
    const teacherParam = params.get('teacher') || params.get('guru');
    const roleParam = params.get('role');
    const idParam = params.get('id');

    if (classParam) {
      role = 'student';
      id = classParam;
    } else if (teacherParam) {
      role = 'teacher';
      id = teacherParam;
    } else if (roleParam === 'teacher' || roleParam === 'student') {
      role = roleParam;
      if (idParam) id = idParam;
    } else if (idParam && db) {
      if (db.classes.some((c) => c.id === idParam)) {
        role = 'student';
        id = idParam;
      } else if (db.teachers.some((t) => t.id === idParam)) {
        role = 'teacher';
        id = idParam;
      }
    }

    return { tab, role, id };
  } catch {
    return {};
  }
}

/**
 * Update URL search parameters according to the current tab and viewer token
 */
export function updateUrlRoute(
  tab: ActiveTabType,
  role: ViewerRole,
  id: string,
  mode: 'push' | 'replace' = 'replace'
) {
  try {
    const url = new URL(window.location.href);

    if (tab === 'home') {
      url.searchParams.set('tab', 'home');
      if (role && id) {
        url.searchParams.set('role', role);
        url.searchParams.set('id', id);
      }
    } else if (tab === 'studio') {
      url.searchParams.set('tab', 'jadwal');
      if (role && id) {
        url.searchParams.set('role', role);
        url.searchParams.set('id', id);
      }
    } else {
      url.searchParams.set('tab', tab);
      url.searchParams.delete('role');
      url.searchParams.delete('id');
      url.searchParams.delete('class');
      url.searchParams.delete('teacher');
      url.searchParams.delete('kelas');
      url.searchParams.delete('guru');
    }

    const nextUrl = url.pathname + url.search + url.hash;
    const currentUrl = window.location.pathname + window.location.search + window.location.hash;

    if (nextUrl !== currentUrl) {
      if (mode === 'push') {
        window.history.pushState({ tab, role, id }, '', nextUrl);
      } else {
        window.history.replaceState({ tab, role, id }, '', nextUrl);
      }
    }
  } catch (e) {
    console.warn('URL update failed:', e);
  }
}
