const PALETTE = ['#2f6fed', '#e0702b', '#2a9d8f', '#c9456b', '#7b61ff', '#8a8f00', '#d4a017', '#1f8fa8', '#b5651d', '#5c5c5c'];
export function datasetColors(i) { return PALETTE[i % PALETTE.length]; }

// "2026년 4월 2주차" → "4월 2주" (연도가 바뀌는 첫 눈금에만 "2026년 4월 2주")
export function shortWeekLabel(label, prevLabel) {
  const m = /^(\d{4})년 (\d+)월 (\d+)주차$/.exec(label || '');
  if (!m) return label;
  const pm = /^(\d{4})년/.exec(prevLabel || '');
  const showYear = !pm || pm[1] !== m[1];
  return `${showYear ? m[1] + '년 ' : ''}${m[2]}월 ${m[3]}주`;
}

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function renderLineChart(canvas, series, { unit, colorOf }) {
  if (canvas._chart) canvas._chart.destroy();
  const nf = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });
  const muted = cssVar('--muted', '#6b7280');
  const grid = cssVar('--border', '#e3e6ea');
  const surface = cssVar('--surface', '#ffffff');
  canvas._chart = new window.Chart(canvas, {
    type: 'line',
    data: {
      labels: series.labels,
      datasets: series.datasets.map((d, i) => {
        const color = (colorOf && colorOf.get(d.companyId)) || datasetColors(i);
        return {
          label: d.label, data: d.data, borderColor: color, backgroundColor: color,
          spanGaps: false, tension: 0.3, borderWidth: 2,
          pointRadius: 0, pointHoverRadius: 4, pointHitRadius: 12, pointBorderColor: surface, pointBorderWidth: 2,
        };
      }),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 4, right: 8 } },
      plugins: {
        title: { display: false },
        legend: {
          position: 'top', align: 'end',
          labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, padding: 14, color: muted, font: { size: 12 } },
        },
        tooltip: {
          backgroundColor: cssVar('--text', '#1c2024'), titleFont: { weight: '600' }, padding: 10, boxPadding: 4, usePointStyle: true,
          callbacks: {
            label: (c) => ` ${c.dataset.label}  ${c.parsed.y == null ? '-' : nf.format(c.parsed.y) + ' ' + unit}`,
            title: (items) => items.length ? `${series.labels[items[0].dataIndex]} (${series.weekStarts[items[0].dataIndex]}~)` : '',
          },
        },
      },
      scales: {
        x: {
          grid: { display: false }, border: { color: grid },
          ticks: { color: muted, font: { size: 11 }, maxRotation: 0, autoSkip: true, autoSkipPadding: 16,
            callback: (v, i) => shortWeekLabel(series.labels[i], i > 0 ? series.labels[i - 1] : null) },
        },
        y: {
          beginAtZero: true, border: { display: false },
          grid: { color: grid, drawTicks: false },
          ticks: { color: muted, font: { size: 11 }, padding: 8, maxTicksLimit: 6, callback: (v) => `${nf.format(v)} ${unit}` },
        },
      },
    },
  });
  return canvas._chart;
}
