// TypeScript type-check smoke test for octavian package
import * as octavian from 'octavian';

// Verify the module resolves and types are accessible
const _exports: typeof octavian = octavian;
void _exports;
