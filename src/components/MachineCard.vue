<script setup>
import { computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'

const props = defineProps({
  machine: {
    type: Object,
    required: true,
  },
})

const statusColor = computed(() => {
  switch (props.machine.status) {
    case 'Harvesting':
      return 'var(--accent)'
    case 'Transport':
      return 'var(--warn)'
    case 'Maintenance':
      return 'var(--bad)'
    default:
      return 'var(--text-dim)'
  }
})

function colorFor(kind, raw) {
  if (kind === 'fuel') {
    if (raw < 20) return '#e05a4a'
    if (raw < 40) return '#e0a83d'
    return '#43c17e'
  }
  if (kind === 'temp') {
    if (raw > 235) return '#e05a4a'
    if (raw > 215) return '#e0a83d'
    return '#43c17e'
  }
  if (kind === 'pressure') {
    if (raw === 0) return '#5b6472'
    if (raw > 2400) return '#e05a4a'
    if (raw > 2000) return '#e0a83d'
    return '#43c17e'
  }
  return '#43c17e'
}

function gaugeOptions(color, name, label) {
  return {
    chart: { type: 'radialBar', width: '100%', sparkline: { enabled: true } },
    colors: [color],
    labels: [name],
    plotOptions: {
      radialBar: {
        hollow: { size: '58%' },
        track: { background: 'rgba(128,128,128,0.18)' },
        dataLabels: {
          name: {
            show: true,
            offsetY: -5,
            fontSize: '10px',
            color: '#8a919b',
          },
          value: {
            show: true,
            offsetY: -4,
            fontSize: '13px',
            fontWeight: 600,
            color: '#e8ebee',
            formatter: () => label,
          },
        },
      },
    },
    stroke: { lineCap: 'round' },
  }
}

const gauges = computed(() => {
  const m = props.machine
  const tempPct = Math.min(100, Math.max(0, ((m.engineTemp - 60) / (260 - 60)) * 100))
  const pressurePct = Math.min(100, Math.max(0, (m.hydraulicPressure / 3000) * 100))

  return [
    {
      key: 'fuel',
      series: [m.fuelLevel],
      options: gaugeOptions(colorFor('fuel', m.fuelLevel), 'Fuel', `${m.fuelLevel}%`),
    },
    {
      key: 'temp',
      series: [tempPct],
      options: gaugeOptions(colorFor('temp', m.engineTemp), 'Engine Temp', `${m.engineTemp}°F`),
    },
    {
      key: 'pressure',
      series: [pressurePct],
      options: gaugeOptions(colorFor('pressure', m.hydraulicPressure), 'Hydraulic', `${m.hydraulicPressure} psi`),
    },
  ]
})

const trendOptions = computed(() => ({
  chart: {
    type: 'area',
    width: '100%',
    sparkline: { enabled: true },
    animations: { enabled: false },
  },
  stroke: { curve: 'smooth', width: 2 },
  fill: {
    type: 'gradient',
    gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0, stops: [0, 90] },
  },
  colors: [statusColor.value],
  tooltip: {
    theme: 'dark',
    x: { show: true },
    y: { formatter: (v) => `${v} bins/hr` },
  },
  xaxis: { categories: props.machine.throughputHistory.map((p) => p.time) },
}))

const trendSeries = computed(() => [
  { name: 'Throughput', data: props.machine.throughputHistory.map((p) => p.binsPerHour) },
])

const peakThroughput = computed(() =>
  Math.max(...props.machine.throughputHistory.map((p) => p.binsPerHour))
)
</script>

<template>
  <article class="card">
    <header class="card-head">
      <div>
        <h2>{{ machine.name }}</h2>
        <p class="model">{{ machine.model }}</p>
      </div>
      <span class="status" :style="{ '--status-color': statusColor }">{{ machine.status }}</span>
    </header>

    <div class="meta">
      <span>{{ machine.orchardBlock }}</span>
      <span class="dot">•</span>
      <span>{{ machine.engineHours.toLocaleString() }} engine hrs</span>
    </div>

    <div class="gauges">
      <div class="gauge" v-for="g in gauges" :key="g.key">
        <VueApexCharts type="radialBar" height="130" :options="g.options" :series="g.series" />
      </div>
    </div>

    <div class="chips">
      <div class="chip">
        <span class="chip-label">Bruise Rate</span>
        <span class="chip-value">{{ machine.bruiseRate }}%</span>
      </div>
      <div class="chip">
        <span class="chip-label">Ground Speed</span>
        <span class="chip-value">{{ machine.groundSpeed }} mph</span>
      </div>
    </div>

    <div class="trend">
      <div class="trend-head">
        <span>Throughput (bins/hr)</span>
        <span class="trend-peak">peak {{ peakThroughput }}</span>
      </div>
      <VueApexCharts type="area" height="70" :options="trendOptions" :series="trendSeries" />
    </div>
  </article>
</template>

<style scoped>
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.card-head h2 {
  font-size: 17px;
}

.model {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: var(--text-dim);
}

.status {
  flex-shrink: 0;
  font-size: 11.5px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  color: var(--status-color);
  background: color-mix(in srgb, var(--status-color) 15%, transparent);
  white-space: nowrap;
}

.meta {
  font-size: 12.5px;
  color: var(--text-dim);
  display: flex;
  gap: 8px;
  align-items: center;
}

.dot {
  opacity: 0.5;
}

.gauges {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
}

.chips {
  display: flex;
  gap: 10px;
}

.chip {
  flex: 1;
  background: var(--accent-bg);
  border-radius: 10px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chip-label {
  font-size: 11px;
  color: var(--text-dim);
}

.chip-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-h);
}

.trend {
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.trend-head {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  color: var(--text-dim);
  margin-bottom: 4px;
}
</style>
