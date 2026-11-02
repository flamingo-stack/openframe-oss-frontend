#!/usr/bin/env node
/** The loading gate under its older name (`scripts/lib/loading-gate.mjs`; the rules are the lib engine's header). */
import { runLoadingGate } from './lib/loading-gate.mjs';

runLoadingGate('check-skeleton-full-page');
