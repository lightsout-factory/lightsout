import { describe, expect, test } from '@jest/globals';
import { parsePhaseDeclarations } from '#src/plan/common/phases/parsePhaseDeclarations.ts';
import { setupPhaseDeclarationsOverview } from '#tests/helpers/setupPhaseDeclarationsOverview.ts';

describe('parsePhaseDeclarations', () => {
	test('a Renames only bullet saying yes declares the phase rename-only, and anything else declares nothing', () => {
		const { plan } = setupPhaseDeclarationsOverview({
			rows: `| 1 | \`phase1-rename.md\` | the rename | 0 | 4 |
| 2 | \`phase2-shouted.md\` | the shouted rename | 0 | 4 |
| 3 | \`phase3-plain.md\` | the plain phase | 0 | 4 |
| 4 | \`phase4-no.md\` | the declined rename | 0 | 4 |
| 5 | \`phase5-other.md\` | the unclear rename | 0 | 4 |`,
			declarations: `### Phase 1 — \`phase1-rename.md\`

- **Creates:** none
- **Exports:** none
- **Scripts:** none
- **File budget:** 4
- **Renames only:** yes

### Phase 2 — \`phase2-shouted.md\`

- **Creates:** none
- **Exports:** none
- **Scripts:** none
- **RENAMES ONLY:**  YES

### Phase 3 — \`phase3-plain.md\`

- **Creates:** none
- **Exports:** none
- **Scripts:** none

### Phase 4 — \`phase4-no.md\`

- **Creates:** none
- **Exports:** none
- **Scripts:** none
- **Renames only:** no

### Phase 5 — \`phase5-other.md\`

- **Creates:** none
- **Exports:** none
- **Scripts:** none
- **Renames only:** true`,
		});

		const declarations = parsePhaseDeclarations({ plan });

		// the key is omitted rather than set to false, so every existing
		// strict-equality fixture of a declaration stays valid
		expect(
			declarations.map((declaration) => ({
				file: declaration.file,
				carriesBuildMode: Object.hasOwn(declaration, 'buildMode'),
				buildMode: declaration.buildMode,
			})),
		).toStrictEqual([
			{ file: 'phase1-rename.md', carriesBuildMode: true, buildMode: 'renames-only' },
			{ file: 'phase2-shouted.md', carriesBuildMode: true, buildMode: 'renames-only' },
			{ file: 'phase3-plain.md', carriesBuildMode: false, buildMode: undefined },
			{ file: 'phase4-no.md', carriesBuildMode: false, buildMode: undefined },
			{ file: 'phase5-other.md', carriesBuildMode: false, buildMode: undefined },
		]);
	});

	test('an orphan block keeps its Renames only declaration, and a row with no block declares nothing', () => {
		const { plan } = setupPhaseDeclarationsOverview({
			rows: '| 1 | `phase1-lonely.md` | the lonely | 0 | 4 |',
			declarations: `### Phase 2 — \`phase2-ghost.md\`

- **Creates:** none
- **Exports:** none
- **Scripts:** none
- **Renames only:** yes`,
		});

		const declarations = parsePhaseDeclarations({ plan });

		// the orphan is reported rather than repaired, so what it declares survives
		expect(
			declarations.map((declaration) => ({
				file: declaration.file,
				number: declaration.number,
				carriesBuildMode: Object.hasOwn(declaration, 'buildMode'),
				buildMode: declaration.buildMode,
			})),
		).toStrictEqual([
			{ file: 'phase1-lonely.md', number: 1, carriesBuildMode: false, buildMode: undefined },
			{ file: 'phase2-ghost.md', number: 0, carriesBuildMode: true, buildMode: 'renames-only' },
		]);
	});

	test('parsePhaseDeclarations: each mode bullet saying yes declares its build mode, and a block with neither carries no buildMode key', () => {
		const { plan } = setupPhaseDeclarationsOverview({
			rows: `| 1 | \`phase1-move.md\` | the move | 0 | 300 |
| 2 | \`phase2-rename.md\` | the rename | 0 | 4 |
| 3 | \`phase3-declined.md\` | the declined move | 0 | 4 |
| 4 | \`phase4-plain.md\` | the plain phase | 0 | 4 |`,
			declarations: `### Phase 1 — \`phase1-move.md\`

- **Creates:** none
- **Exports:** none
- **Scripts:** none
- **Moves folders and files only:** yes

### Phase 2 — \`phase2-rename.md\`

- **Creates:** none
- **Exports:** none
- **Scripts:** none
- **Renames only:** yes

### Phase 3 — \`phase3-declined.md\`

- **Creates:** none
- **Exports:** none
- **Scripts:** none
- **Moves folders and files only:** no
- **Renames only:** no

### Phase 4 — \`phase4-plain.md\`

- **Creates:** none
- **Exports:** none
- **Scripts:** none`,
		});

		const declarations = parsePhaseDeclarations({ plan });

		// the key is omitted rather than set to standard, so every existing
		// strict-equality fixture of a declaration stays valid
		expect(
			declarations.map((declaration) => ({
				file: declaration.file,
				carriesBuildMode: Object.hasOwn(declaration, 'buildMode'),
				buildMode: declaration.buildMode,
				carriesBuildModeConflict: Object.hasOwn(declaration, 'buildModeConflict'),
			})),
		).toStrictEqual([
			{ file: 'phase1-move.md', carriesBuildMode: true, buildMode: 'move-folders-and-files', carriesBuildModeConflict: false },
			{ file: 'phase2-rename.md', carriesBuildMode: true, buildMode: 'renames-only', carriesBuildModeConflict: false },
			{ file: 'phase3-declined.md', carriesBuildMode: false, buildMode: undefined, carriesBuildModeConflict: false },
			{ file: 'phase4-plain.md', carriesBuildMode: false, buildMode: undefined, carriesBuildModeConflict: false },
		]);
	});

	test('parsePhaseDeclarations: a block saying yes to both mode bullets declares a conflict rather than either mode', () => {
		const { plan } = setupPhaseDeclarationsOverview({
			rows: '| 1 | `phase1-both.md` | the confused phase | 0 | 4 |',
			declarations: `### Phase 1 — \`phase1-both.md\`

- **Creates:** none
- **Exports:** none
- **Scripts:** none
- **Renames only:** yes
- **Moves folders and files only:** yes

### Phase 2 — \`phase2-ghost.md\`

- **Creates:** none
- **Exports:** none
- **Scripts:** none
- **Moves folders and files only:** yes
- **Renames only:** yes`,
		});

		const declarations = parsePhaseDeclarations({ plan });

		// guessing which bullet wins would hide the drafting mistake, so neither
		// the row-matched block nor the orphan declares a mode
		expect(
			declarations.map((declaration) => ({
				file: declaration.file,
				number: declaration.number,
				carriesBuildMode: Object.hasOwn(declaration, 'buildMode'),
				buildModeConflict: declaration.buildModeConflict,
			})),
		).toStrictEqual([
			{ file: 'phase1-both.md', number: 1, carriesBuildMode: false, buildModeConflict: true },
			{ file: 'phase2-ghost.md', number: 0, carriesBuildMode: false, buildModeConflict: true },
		]);
	});
});
