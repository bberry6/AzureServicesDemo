const HOURS = ['6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM']

// Smooth bell-shaped daily throughput curve, scaled per machine so charts
// look like plausible orchard activity (ramps up, peaks midday, tapers off).
function throughputCurve(peak, noise) {
  return HOURS.map((time, i) => {
    const x = (i / (HOURS.length - 1)) * Math.PI
    const base = Math.sin(x) * peak
    const wobble = Math.sin(i * 1.7 + peak) * noise
    return { time, binsPerHour: Math.max(0, Math.round(base + wobble)) }
  })
}

export const machines = [
  {
    id: 'gg-210',
    name: 'Gala Glider GG-210',
    model: 'Shake & Catch Harvester',
    orchardBlock: 'Block 4 — Gala',
    status: 'Harvesting',
    engineHours: 2148,
    fuelLevel: 74,
    engineTemp: 198,
    hydraulicPressure: 1850,
    bruiseRate: 2.1,
    groundSpeed: 1.8,
    throughputHistory: throughputCurve(42, 4),
  },
  {
    id: 'hh-330',
    name: 'Honeycrisp Hauler HH-330',
    model: 'Platform Picker',
    orchardBlock: 'Block 2 — Honeycrisp',
    status: 'Harvesting',
    engineHours: 3462,
    fuelLevel: 58,
    engineTemp: 205,
    hydraulicPressure: 2110,
    bruiseRate: 3.4,
    groundSpeed: 1.2,
    throughputHistory: throughputCurve(36, 5),
  },
  {
    id: 'ff-150',
    name: 'Fuji Flow FF-150',
    model: 'Shake & Catch Harvester',
    orchardBlock: 'Block 9 — Fuji',
    status: 'Idle',
    engineHours: 1890,
    fuelLevel: 91,
    engineTemp: 142,
    hydraulicPressure: 420,
    bruiseRate: 0,
    groundSpeed: 0,
    throughputHistory: throughputCurve(4, 1),
  },
  {
    id: 'bb-400',
    name: 'Braeburn Beast BB-400',
    model: 'Bin Trailer Harvester',
    orchardBlock: 'Block 1 — Braeburn',
    status: 'Transport',
    engineHours: 4201,
    fuelLevel: 36,
    engineTemp: 187,
    hydraulicPressure: 610,
    bruiseRate: 1.6,
    groundSpeed: 14.5,
    throughputHistory: throughputCurve(8, 2),
  },
  {
    id: 'ee-180',
    name: 'Empire Edge EE-180',
    model: 'Platform Picker',
    orchardBlock: 'Block 6 — Empire',
    status: 'Maintenance',
    engineHours: 2977,
    fuelLevel: 12,
    engineTemp: 96,
    hydraulicPressure: 0,
    bruiseRate: 0,
    groundSpeed: 0,
    throughputHistory: throughputCurve(0, 0.5),
  },
  {
    id: 'cc-260',
    name: 'Cortland Crawler CC-260',
    model: 'Shake & Catch Harvester',
    orchardBlock: 'Block 3 — Cortland',
    status: 'Harvesting',
    engineHours: 1523,
    fuelLevel: 83,
    engineTemp: 211,
    hydraulicPressure: 1975,
    bruiseRate: 4.2,
    groundSpeed: 2.1,
    throughputHistory: throughputCurve(39, 6),
  },
]
