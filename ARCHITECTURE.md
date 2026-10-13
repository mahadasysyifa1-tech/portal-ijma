# Architecture & Codebase Map

> **Purpose**: Lean reference guide for rapid code navigation, domain boundaries, and data flow. Always consult this before making changes to prevent speculative file searching.

---

## 1. System Invariants & Data Flow

- **Native Format**: **JSON** (`DatabaseState`). The frontend and backend communicate exclusively via JSON payloads (`GET /api/database`, `POST /api/database`).
- **Database Engine**: **Turso Cloud (LibSQL)** is the sole source of truth.
  - **No local SQLite files**: Never recreate `data/*.db` or `better-sqlite3`.
  - Writes are atomic batch statements (`client.batch(..., 'write')`).
  - Reads query Turso tables and map SQL rows into the native `DatabaseState` JSON.
- **Client Cache**: `localStorage['school_schedule_db']` provides an offline fallback if Turso is unreachable. A top-bar Save button commits dirty changes to Turso.

---

## 2. File & Domain Map

| Path | Purpose |
| :--- | :--- |
| `server.ts` | Express server entry point mounting `/api/database` routes and Vite middleware. |
| `server/db/index.ts` | Turso data router (`getDatabaseState`, `saveDatabaseState`, health checks). |
| `server/db/schemas.ts` | Static DDL SQL statements (`METADATA_SCHEMA_SQL`, `KALDIK_SCHEMA_SQL`). |
| `src/types.ts` | Canonical TypeScript definitions for all domains. |
| `src/App.tsx` | Main application shell, route state, dirty tracking, and save trigger. |
| `src/components/EntityManager.tsx` | Flat database browser for institutional master data with cascading FK sync. |
| `src/components/database/MateriDatabaseTab.tsx` | Material syllabus editor (book-driven chapter/volume selector, hal ranges). |
| `src/components/ruleManager/RuleManagerView.tsx` | Timetable rules studio, syllabus scopes, and meeting matrix. |
| `src/components/ruleManager/SyllabusPanel.tsx` | Curriculum distribution table, book badges, dynamic pacing. |
| `src/components/ruleManager/SyllabusScopeModal.tsx` | Dedicated Multi-Book & Multi-Range Syllabus Scope modal editor. |
| `src/components/kaldik/KaldikView.tsx` | Academic calendar (Kaldik) visualizer and term periods manager. |
| `src/components/ExportImportView.tsx` | Full JSON backup/restore and Material CSV importer/exporter. |
| `src/utils/scheduleEngine.ts` | Timetable conflict detection engine. |
| `src/utils/pacingEngine.ts` | Syllabus pacing engine, meeting indices, and book-subject mapping. |
| `src/utils/normalize.ts` | State sanitizer ensuring all arrays and legacy properties are normalized. |

---

## 3. Syllabus & Material Hierarchy

```
Book (books table)
 └── BookChapter (book_chapters table) [id, chapter_num, title, page_start, page_end]
      └── Material / SyllabusUnit (materials table)
           ├── bookId -> Book.id
           ├── chapterBookId -> BookChapter.id (synced with part / Jilid)
           ├── part -> Jilid / Volume number
           ├── no / eno -> Sequential syllabus order (automatic)
           └── SyllabusScope (syllabus_scopes / syllabus_scope_items)
                └── Scopes materials to specific class sections & terms
```

---

## 4. Entity Relationships (Cross-Database Map)

Because Metadata and Kaldik live in separate Turso databases, cross-table integrity is maintained in the application state:
- **Class (`cls-*`)** -> referenced by `rules.classId` & `syllabusScopes.class_section_id`
- **Subject (`sub-*`)** -> referenced by `rules.subjectId`, `books.defaultSubjectId`, `syllabusScopes.subject_id`
- **Teacher (`tch-*`)** -> referenced by `rules.teacherId`, `subjects.defaultTeacherId`
- **Room (`rm-*`)** -> referenced by `rules.roomId`, `classes.defaultRoomId`
- **Book (`bk-*`)** -> referenced by `materials.bookId`, `syllabusScopes.book_ids`
- **Period (`prd-*`)** -> referenced by `rules.periodIds`, `kaldikEvents.periodId`
---

## 5. Development Guidelines

1. **Keep components under 500 lines**: Split heavy logic into sub-components.
2. **Never import CSV helpers for core entities**: Only materials retain CSV import/export.
3. **Always run type-check before completing**: `npx tsc --noEmit` followed by `compile_applet`.
