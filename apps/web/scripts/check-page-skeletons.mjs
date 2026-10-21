#!/usr/bin/env node
/** The loading gate (`scripts/lib/loading-gate.mjs`; the rules are the lib engine's header). */
import { runLoadingGate } from './lib/loading-gate.mjs';

runLoadingGate('check-page-skeletons');
