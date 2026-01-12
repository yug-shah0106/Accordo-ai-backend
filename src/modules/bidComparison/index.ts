// Bid Comparison Module - Vendor Bid Comparison System
// Compares vendor bids, generates PDF reports, and enables vendor selection

export * from './bidComparison.types.js';
export * from './bidComparison.service.js';
export * from './bidComparison.controller.js';
export { default as bidComparisonRoutes } from './bidComparison.routes.js';
export { startDeadlineScheduler, stopDeadlineScheduler, isSchedulerRunning, triggerDeadlineCheck } from './scheduler/deadlineChecker.js';
export { generateComparisonPDF, getPDFUrl } from './pdf/pdfGenerator.js';
export { generateMetricsSummary, generateNarrativeSummary } from './summary/summaryGenerator.js';
