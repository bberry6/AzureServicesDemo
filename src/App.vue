<script setup>
import { machines } from './data/machines.js'
import MachineCard from './components/MachineCard.vue'

const activeCount = machines.filter((m) => m.status === 'Harvesting').length
</script>

<template>
  <div class="dashboard">
    <header class="page-head">
      <div>
        <h1>Orchard Fleet Dashboard</h1>
        <p class="subtitle">Apple harvester telemetry — {{ machines.length }} machines, {{ activeCount }} actively harvesting</p>
      </div>
    </header>

    <main class="grid">
      <MachineCard v-for="m in machines" :key="m.id" :machine="m" />
    </main>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px 24px 60px;
}

.page-head {
  margin-bottom: 28px;
}

.page-head h1 {
  font-size: 26px;
  letter-spacing: -0.3px;
}

.subtitle {
  margin: 6px 0 0;
  color: var(--text-dim);
  font-size: 14px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}
</style>
