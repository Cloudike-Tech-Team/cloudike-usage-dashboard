const PALETTE = ['#2f6fed', '#e0702b', '#2a9d8f', '#c9456b', '#7b61ff', '#8a8f00', '#d4a017', '#1f8fa8', '#b5651d', '#5c5c5c'];
export function datasetColors(i) { return PALETTE[i % PALETTE.length]; }

export function renderLineChart(canvas, series, { title, unit }) {
  if (canvas._chart) canvas._chart.destroy();
  const nf = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });
  canvas._chart = new window.Chart(canvas, {
    type: 'line',
    data: {
      labels: series.labels,
      datasets: series.datasets.map((d, i) => ({
        label: d.label, data: d.data, borderColor: datasetColors(i), backgroundColor: datasetColors(i),
        spanGaps: false, tension: 0.2, pointRadius: 2, borderWidth: 2,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: {
        title: { display: true, text: title },
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y == null ? '-' : nf.format(c.parsed.y) + ' ' + unit}`,
          title: (items) => items.length ? `${series.labels[items[0].dataIndex]} (${series.weekStarts[items[0].dataIndex]}~)` : '' } },
      },
      scales: { x: { ticks: { maxRotation: 60, autoSkip: true } }, y: { beginAtZero: true, title: { display: true, text: unit } } },
    },
  });
  return canvas._chart;
}
