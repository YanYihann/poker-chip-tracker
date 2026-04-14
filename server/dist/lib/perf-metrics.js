const MAX_WINDOW_SAMPLES = 500;
const LOG_EVERY_SAMPLES = 50;
const SLOW_THRESHOLD_MS = 250;
const metricStore = new Map();
function toRoundedMs(value) {
    return Number(value.toFixed(2));
}
function percentile(values, ratio) {
    if (values.length === 0) {
        return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(ratio * sorted.length) - 1));
    return sorted[index];
}
export function recordPerfSample(metricName, durationMs, context) {
    const series = metricStore.get(metricName) ?? { samples: [], totalCount: 0 };
    series.totalCount += 1;
    series.samples.push(durationMs);
    if (series.samples.length > MAX_WINDOW_SAMPLES) {
        series.samples.shift();
    }
    metricStore.set(metricName, series);
    const roundedDurationMs = toRoundedMs(durationMs);
    if (durationMs >= SLOW_THRESHOLD_MS) {
        console.warn(`[perf] slow ${metricName}`, {
            durationMs: roundedDurationMs,
            ...(context ?? {})
        });
    }
    if (series.totalCount % LOG_EVERY_SAMPLES !== 0) {
        return;
    }
    const total = series.samples.reduce((sum, value) => sum + value, 0);
    const avg = series.samples.length === 0 ? 0 : total / series.samples.length;
    const p50 = percentile(series.samples, 0.5);
    const p95 = percentile(series.samples, 0.95);
    console.log(`[perf] ${metricName}`, {
        count: series.totalCount,
        window: series.samples.length,
        p50Ms: toRoundedMs(p50),
        p95Ms: toRoundedMs(p95),
        avgMs: toRoundedMs(avg)
    });
}
