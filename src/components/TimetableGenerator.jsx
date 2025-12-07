import React, { useState, useEffect, useCallback, useMemo } from 'react';

// --- Configuration Constants ---
const LOCAL_STORAGE_KEY = 'timetable_config_react_v6_divisions';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ACADEMIC_YEARS = ['2025-2026', '2024-2025', '2023-2024'];
const BRANCHES = ['CSE', 'ECE', 'MECH', 'CIVIL', 'EEE', 'IT'];
const SEMESTER_MAP = {
  Odd: [1, 3, 5, 7],
  Even: [2, 4, 6, 8],
};
const SECTIONS = ['A', 'B', 'C'];
const PERIOD_OPTIONS = [4, 5, 6, 7, 8];

// Break Durations
const PERIOD_DURATION = 55;   // in minutes
const LAB_DURATION = 120;     // 2 periods in minutes
const MINI_BREAK_DURATION = 30; // Between P2 and P3
const LUNCH_BREAK_DURATION = 45; // Between P4 and P5 (lunch as 5th period)

const MAX_TEACHERS = 32; // Enforcing the user-requested limit
const MAX_THEORY_PER_DAY = 4; // User-defined constraint

const MORNING_START_MINUTES = 9 * 60; // 9:00 AM
const EVENING_START_MINUTES = 13 * 60; // 1:00 PM (13:00)

// Initial default configuration state
const initialConfig = {
  academicYear: ACADEMIC_YEARS[0],
  semesterType: 'Even',
  semester: 2,
  branch: 'CSE',
  classNo: 4,
  section: 'A',
  workingDays: 5,
  periodsPerDay: 7, // P1 to P7 (Total 7 Periods)
  scheduleType: 'Morning', // New state for schedule
  periodDuration: PERIOD_DURATION,
  labDuration: LAB_DURATION,
  teachers: Array.from({ length: Math.min(8, MAX_TEACHERS) }, (_, i) => `T-Faculty ${i + 1}`),
  rooms: ['C-101', 'C-102', 'L-201', 'L-202', 'L-203'],
  // divisions represent different groups/classes that need separate timetables
  divisions: ['A', 'B'],
  subjects: [
    { id: 1, name: 'Data Structures', type: 'Theory', count: 4,  faculty: 'T-Faculty 1' },
    { id: 2, name: 'Operating Systems', type: 'Theory', count: 4, faculty: 'T-Faculty 2' },
    { id: 3, name: 'DBMS', type: 'Theory', count: 4, faculty: 'T-Faculty 3' },
    { id: 4, name: 'Algorithms', type: 'Theory', count: 4, faculty: 'T-Faculty 4' },
    { id: 5, name: 'Mathematics', type: 'Theory', count: 3, faculty: 'T-Faculty 5' },
    { id: 6, name: 'DS', type: 'Theory', count: 1, faculty: 'T-Faculty 6' },
    { id: 7, name: 'LAB-DBMS', type: 'Lab', count: 1, faculty: 'T-Faculty 7' },
    { id: 8, name: 'LAB-Python', type: 'Lab', count: 1, faculty: 'T-Faculty 8' },
  ],
};

// ---------------- Seeded utilities ----------------
// Simple hashCode to produce number from string
const hashCode = (str) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};

// Mulberry32 PRNG
const mulberry32 = (a) => {
  return function() {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// seededShuffle: Fisher-Yates using seeded PRNG
const seededShuffle = (array, seed) => {
  const arr = [...array];
  const rand = mulberry32(seed >>> 0);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// --- Helper Functions ---
const formatTime = (minutes) => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const LucideIcon = ({ name, className = 'w-5 h-5' }) => {
  const Icon = typeof window !== 'undefined' && window.lucide && window.lucide.icons ? window.lucide.icons[name] : null;
  if (Icon) {
    return <Icon className={className} />;
  }
  return <span className={`mr-2 ${className} font-bold inline-block`}>[{name ? name.charAt(0).toUpperCase() : '?'}]</span>;
};

// getLogicalSlotInfo: returns period/break mapping for visualIndex
const getLogicalSlotInfo = (visualIndex, maxPeriods) => {
  // Visual indexes start at 1
  // We always place Mini Break after P2 -> visualIndex 3 is Mini Break
  if (visualIndex === 3) {
    return { type: 'break', name: 'Mini Break', period: 'Mini Break', duration: MINI_BREAK_DURATION, logicalPeriod: null, spans: 1 };
  }

  // Place Lunch Break so that lunch occupies the 5th period slot.
  // For example (visual indexes): 1=P1,2=P2,3=Mini,4=P3,5=P4,6=Lunch,7=P5,...
  if (visualIndex === 6 && maxPeriods >= 5) {
    return { type: 'break', name: 'Lunch Break', period: 'Lunch Break', duration: LUNCH_BREAK_DURATION, logicalPeriod: null, spans: 1 };
  }

  // Calculate logical period number after accounting for breaks before this visual index
  let breaksPassed = 0;
  if (visualIndex > 3) breaksPassed++;
  if (maxPeriods >= 5 && visualIndex > 6) breaksPassed++; // adjusted for lunch at visualIndex 6

  const logicalPeriod = visualIndex - breaksPassed;

  if (logicalPeriod < 1 || logicalPeriod > maxPeriods) return null;

  return {
    type: 'period',
    name: `P${logicalPeriod}`,
    period: logicalPeriod,
    duration: PERIOD_DURATION,
    logicalPeriod,
    spans: 1,
  };
};

// generateTimetable: rewritten to iterate logical periods and properly place breaks — ensures labs occupy two consecutive logical periods and are visible
const generateTimetable = (config, division = null, globalDayUsage = null) => {
  const {
    workingDays, periodsPerDay, subjects, rooms, scheduleType
  } = config;

  // 1. Validate Assignments
  const unassignedSubject = subjects.find(s => !s.faculty || s.faculty === 'Unassigned');
  if (unassignedSubject) {
    return { error: `Subject "${unassignedSubject.name}" must have a faculty assigned. Generation halted.` };
  }
  if (rooms.length === 0) {
    return { error: 'Rooms list is empty. Generation halted.' };
  }

  // Build requiredCounts map (name -> remaining sessions). For labs, count is number of lab-sessions (each consumes 2 logical periods)
  let requiredCounts = {};
  subjects.forEach(sub => {
    requiredCounts[sub.name] = (requiredCounts[sub.name] || 0) + sub.count;
  });

  const daysArray = DAYS.slice(0, workingDays);
  const newSchedule = [];
  let warning = '';

  // Today's ISO date for deterministic seeding across runs for same day
  const todayISO = new Date().toISOString().slice(0,10);

  for (let d = 0; d < workingDays; d++) {
    const day = daysArray[d];
    let daySchedule = [];
    let facultyUsedToday = new Set();
    let theoryCountToday = 0;
    let currentTime = scheduleType === 'Morning' ? MORNING_START_MINUTES : EVENING_START_MINUTES;

    // If division provided, create a deterministic seed per division/day; otherwise randomize daily
    const seedBase = division ? `${todayISO}-${day}-${division}` : `${Math.random() + ''}-${Date.now()}`;
    const seed = hashCode(seedBase);

    // Prepare globalDayUsage structure if provided
    if (globalDayUsage) {
      if (!globalDayUsage[day]) {
        globalDayUsage[day] = {};
        for (let p = 1; p <= periodsPerDay; p++) {
          globalDayUsage[day][p] = { faculties: new Set(), labRooms: new Set() };
        }
      } else {
        // ensure all logical periods exist
        for (let p = 1; p <= periodsPerDay; p++) {
          if (!globalDayUsage[day][p]) globalDayUsage[day][p] = { faculties: new Set(), labRooms: new Set() };
        }
      }
    }

    // Split subjects into theory & lab for prioritized selection
    const theorySubjects = subjects.filter(s => s.type === 'Theory');
    const labSubjects = subjects.filter(s => s.type === 'Lab');

    // Deterministic shuffles
    const shuffledTheories = seededShuffle(theorySubjects, seed ^ 0xA5A5A5A5);
    const shuffledLabs = seededShuffle(labSubjects, seed ^ 0x5A5A5A5A);

    // Combined list: interleave a bit by alternating (keeps labs visible in pool)
    const combinedSubjects = [];
    let ti = 0, li = 0;
    while (ti < shuffledTheories.length || li < shuffledLabs.length) {
      if (ti < shuffledTheories.length) combinedSubjects.push(shuffledTheories[ti++]);
      if (li < shuffledLabs.length) combinedSubjects.push(shuffledLabs[li++]);
    }

    // Helper: check global clash for a given faculty and optional room for given logical periods
    const hasGlobalClash = (faculty, room, logicalPeriod, span = 1) => {
      if (!globalDayUsage) return false;
      for (let lp = logicalPeriod; lp < logicalPeriod + span; lp++) {
        const usage = globalDayUsage[day][lp];
        if (!usage) continue;
        if (faculty && usage.faculties.has(faculty)) return true;
        if (room && usage.labRooms.has(room)) return true;
      }
      return false;
    };

    // Iterate logical periods and insert breaks at correct positions
    let lp = 1;
    while (lp <= periodsPerDay) {
      // Insert mini break before P3 (i.e., after P2)
      if (lp === 3) {
        daySchedule.push({
          period: 'Mini Break',
          type: 'break',
          name: 'Mini Break',
          teacher: 'Break',
          room: 'Break',
          startTime: formatTime(currentTime),
          endTime: formatTime(currentTime + MINI_BREAK_DURATION),
          duration: MINI_BREAK_DURATION,
          spans: 1,
        });
        currentTime += MINI_BREAK_DURATION;
      }

      // Insert lunch break so lunch occupies the 5th logical slot (i.e., lunch before scheduling P5)
      if (lp === 5 && periodsPerDay >= 5) {
        daySchedule.push({
          period: 'Lunch Break',
          type: 'break',
          name: 'Lunch Break',
          teacher: 'Break',
          room: 'Break',
          startTime: formatTime(currentTime),
          endTime: formatTime(currentTime + LUNCH_BREAK_DURATION),
          duration: LUNCH_BREAK_DURATION,
          spans: 1,
        });
        currentTime += LUNCH_BREAK_DURATION;
      }

      // For the current logical period lp, try to schedule a subject
      let subjectToSchedule = null;
      let selectedRoom = null;
      let span = 1; // 1 for theory, 2 for lab

      // Build available subject pools (counts > 0)
      const availableSubjects = combinedSubjects.filter(s => (requiredCounts[s.name] || 0) > 0);

      // Prefer labs when possible: lab must have lp+1 <= periodsPerDay (i.e., two consecutive logical periods)
      const canFitLab = (lp + 1) <= periodsPerDay;

      if (canFitLab) {
        // try lab candidates first that have count remaining and whose faculty/room don't clash
        const labCandidates = availableSubjects.filter(s => s.type === 'Lab');
        // attempt labs in seeded order
        const labPool = seededShuffle(labCandidates, seed ^ (lp * 101));
        for (const lb of labPool) {
          if (facultyUsedToday.has(lb.faculty)) continue; // avoid same faculty twice a day locally
          if (hasGlobalClash(lb.faculty, null, lp, 2)) continue; // faculty busy in global map
          // pick a lab room not globally used for either lp or lp+1
          const labRooms = rooms.filter(r => r.startsWith('L-'));
          const shuffledLabRooms = seededShuffle(labRooms, hashCode(`${seedBase}-${lb.name}-${lp}`));
          const roomChoice = shuffledLabRooms.find(r => !hasGlobalClash(null, r, lp, 2));
          if (!roomChoice) continue;
          // we found a lab to schedule
          subjectToSchedule = lb;
          selectedRoom = roomChoice;
          span = 2;
          break;
        }
      }

      // If no lab selected, try theory
      if (!subjectToSchedule) {
        const canFitTheory = theoryCountToday < MAX_THEORY_PER_DAY;
        if (canFitTheory) {
          const theoryCandidates = availableSubjects.filter(s => s.type === 'Theory');
          // try to find theory without local/global clash first
          let chosenTheory = null;
          for (const th of seededShuffle(theoryCandidates, seed ^ (lp * 131))) {
            if (facultyUsedToday.has(th.faculty)) continue;
            if (hasGlobalClash(th.faculty, null, lp, 1)) continue;
            chosenTheory = th;
            break;
          }
          // if not found, relax and pick any with remaining count
          if (!chosenTheory && theoryCandidates.length > 0) {
            chosenTheory = theoryCandidates[0];
          }
          if (chosenTheory) {
            subjectToSchedule = chosenTheory;
            selectedRoom = (rooms.filter(r => r.startsWith('C-')).length ? seededShuffle(rooms.filter(r => r.startsWith('C-')), hashCode(`${seedBase}-class-${lp}`))[0] : 'Class Room');
            span = 1;
          }
        }
      }

      // Fallback: If still nothing picked, try to pick any subject ignoring some constraints (best-effort)
      if (!subjectToSchedule) {
        // Prefer any theory else any lab (respect lab requiring two logical periods)
        const anyTheory = subjects.filter(s => s.type === 'Theory' && (requiredCounts[s.name] || 0) > 0);
        if (anyTheory.length) {
          subjectToSchedule = anyTheory[0];
          selectedRoom = (rooms.filter(r => r.startsWith('C-')).length ? seededShuffle(rooms.filter(r => r.startsWith('C-')), hashCode(`${seedBase}-class-fallback-${lp}`))[0] : 'Class Room');
          span = 1;
        } else {
          const anyLab = subjects.filter(s => s.type === 'Lab' && (requiredCounts[s.name] || 0) > 0 && (lp + 1) <= periodsPerDay);
          if (anyLab.length) {
            // pick first available lab room that doesn't clash globally
            for (const lb of seededShuffle(anyLab, seed ^ (lp * 171))) {
              const labRooms = rooms.filter(r => r.startsWith('L-'));
              const shuffledLabRooms = seededShuffle(labRooms, hashCode(`${seedBase}-${lb.name}-fallback-${lp}`));
              const rc = shuffledLabRooms.find(r => !hasGlobalClash(null, r, lp, 2));
              if (rc) {
                subjectToSchedule = lb;
                selectedRoom = rc;
                span = 2;
                break;
              }
            }
          }
        }
      }

      if (subjectToSchedule) {
        // decrement counts
        requiredCounts[subjectToSchedule.name] = Math.max(0, (requiredCounts[subjectToSchedule.name] || 0) - 1);

        const isLab = subjectToSchedule.type === 'Lab';
        const duration = span === 2 ? LAB_DURATION : PERIOD_DURATION;
        const endTime = currentTime + duration;

        daySchedule.push({
          period: lp,
          type: subjectToSchedule.type.toLowerCase(),
          name: subjectToSchedule.name,
          teacher: subjectToSchedule.faculty,
          room: selectedRoom || (isLab ? 'Lab Room' : 'Class Room'),
          startTime: formatTime(currentTime),
          endTime: formatTime(endTime),
          duration,
          spans: span,
          logicalPeriod: lp,
        });

        // Update local & global usage
        facultyUsedToday.add(subjectToSchedule.faculty);
        if (!isLab) theoryCountToday++;

        if (globalDayUsage) {
          for (let occ = lp; occ < lp + span; occ++) {
            if (!globalDayUsage[day][occ]) globalDayUsage[day][occ] = { faculties: new Set(), labRooms: new Set() };
            globalDayUsage[day][occ].faculties.add(subjectToSchedule.faculty);
            if (isLab && selectedRoom) globalDayUsage[day][occ].labRooms.add(selectedRoom);
          }
        }

        currentTime = endTime;
        // if lab consumed 2 logical periods, advance lp accordingly
        lp += span;
      } else {
        // No subject to schedule -> Free Period
        daySchedule.push({
          period: lp,
          type: 'free',
          name: 'Free Period',
          teacher: 'N/A',
          room: 'N/A',
          startTime: formatTime(currentTime),
          endTime: formatTime(currentTime + PERIOD_DURATION),
          duration: PERIOD_DURATION,
          spans: 1,
          logicalPeriod: lp,
        });
        currentTime += PERIOD_DURATION;
        lp += 1;
      }
    } // end while logical periods

    newSchedule.push({ day, periods: daySchedule });
  } // end days loop

  const unscheduledCorePeriods = Object.values(requiredCounts).reduce((acc, count) => acc + Math.max(0, count), 0);
  if (unscheduledCorePeriods > 0) {
    warning += ` Warning: ${unscheduledCorePeriods} core sessions could not be scheduled under strict counts. A best-effort fill was used to populate remaining slots.`;
  }

  return { schedule: newSchedule, warning };
};

// --- Sub-Components ---
const Dropdown = ({ name, label, options, value, onChange }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
    <select
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
    >
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  </div>
);

const SimpleArrayEditor = ({ name, title, icon, placeholder, data, onChange, onAdd, onRemove }) => {
  const isTeachers = name === 'teachers';
  const maxItems = isTeachers ? MAX_TEACHERS : Infinity;
  const canAdd = data.length < maxItems;

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300">
      <h3 className="flex items-center text-xl font-bold text-indigo-700 mb-2">
        <LucideIcon name={icon} className="w-5 h-5 mr-2" /> {title}
      </h3>
      <p className="text-xs text-gray-500 mb-4">Edit names directly. Use trash icon to remove.</p>
      <div className="space-y-2 max-h-56 overflow-y-auto pr-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center space-x-2">
            <input
              type="text"
              value={item}
              onChange={(e) => onChange(name, index, e.target.value)}
              className="flex-grow p-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder={placeholder}
            />
            <button type="button" onClick={() => onRemove(name, index)} className="p-1 text-red-600 hover:bg-red-100 rounded-full focus:outline-none focus:ring-0">
              <LucideIcon name="trash-2" className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
      {canAdd ? (
        <button type="button" onClick={() => onAdd(name, placeholder)} className="w-full mt-3 flex justify-center items-center py-2 px-4 border border-indigo-500 text-sm font-medium rounded-md text-indigo-600 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-0">
          <LucideIcon name="plus" className="w-4 h-4 mr-1" /> Add New
        </button>
      ) : (
        <p className="text-xs text-red-500 mt-3 text-center">Maximum {MAX_TEACHERS} teachers limit reached.</p>
      )}
    </div>
  );
};

const SubjectEditor = ({ subjects, teachers, stats, onChange, onAdd, onRemove }) => {
  const assignedFacultyCounts = subjects.reduce((acc, sub) => {
    if (sub.faculty && sub.faculty !== 'Unassigned') {
      acc[sub.faculty] = (acc[sub.faculty] || 0) + 1;
    }
    return acc;
  }, {});

  const getTeacherOptions = useCallback((index) => {
    const currentSubject = subjects[index];
    const currentFaculty = currentSubject.faculty;

    let options = ['Unassigned'];
    const availableTeachers = teachers.filter(teacher =>
      (assignedFacultyCounts[teacher] === undefined || assignedFacultyCounts[teacher] === 0)
      || teacher === currentFaculty
    );

    return [...options, ...availableTeachers];
  }, [subjects, teachers, assignedFacultyCounts]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300 md:col-span-3">
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <h3 className="flex items-center text-xl font-bold text-indigo-700">
          <LucideIcon name="book-open" className="w-5 h-5 mr-2" /> Subjects & Faculty Assignment
        </h3>
        <div className={`text-sm font-mono px-3 py-1 rounded-full ${stats.required > stats.available ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          Periods: {stats.required} / {stats.available} Available
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider px-2">
        <div className="col-span-4">Subject Name</div>
        <div className="col-span-2">Type</div>
        <div className="col-span-2">Sessions</div>
        <div className="col-span-3">Faculty (One Subject Max)</div>
        <div className="col-span-1"></div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
        {subjects.map((sub, index) => (
          <div key={sub.id || index} className="grid grid-cols-12 gap-4 items-center bg-gray-50 p-2 rounded-md">
            <div className="col-span-4">
              <input
                type="text"
                value={sub.name}
                onChange={(e) => onChange(index, 'name', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500"
                placeholder="Subject Name"
              />
            </div>
            <div className="col-span-2">
              <select
                value={sub.type}
                onChange={(e) => onChange(index, 'type', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500"
              >
                <option value="Theory">Theory</option>
                <option value="Lab">Lab (2 periods)</option>
              </select>
            </div>
            <div className="col-span-2">
              <input
                type="number"
                min="1"
                max="10"
                value={sub.count}
                onChange={(e) => onChange(index, 'count', parseInt(e.target.value) || 0)}
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500"
              />
            </div>
            <div className="col-span-3">
              <select
                value={sub.faculty}
                onChange={(e) => onChange(index, 'faculty', e.target.value)}
                className={`w-full p-2 border rounded-md text-sm focus:ring-indigo-500 ${sub.faculty === 'Unassigned' ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              >
                {getTeacherOptions(index).map(teacher => (
                  <option key={teacher} value={teacher}>{teacher}</option>
                ))}
              </select>
            </div>
            <div className="col-span-1 flex justify-end">
              <button type="button" onClick={() => onRemove(index)} className="p-1 text-red-600 hover:bg-red-100 rounded-full focus:outline-none focus:ring-0">
                <LucideIcon name="trash-2" className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={onAdd} className="w-full mt-3 flex justify-center items-center py-2 px-4 border border-indigo-500 text-sm font-medium rounded-md text-indigo-600 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-0">
        <LucideIcon name="plus" className="w-4 h-4 mr-1" /> Add New Subject
      </button>
    </div>
  );
};

const TimetableTable = ({ schedule, maxPeriodsPerDay }) => {
  if (!schedule || schedule.length === 0) return (
    <p className="text-center text-gray-500 p-8 bg-gray-100 rounded-xl">No timetable generated yet for this division. Ensure all subjects are assigned a faculty and hit 'Auto Generate TT'.</p>
  );

  const totalVisualSlots = maxPeriodsPerDay + (maxPeriodsPerDay >= 5 ? 2 : 1);

  const columnHeaders = useMemo(() => {
    const headers = [];
    for (let i = 1; i <= totalVisualSlots; i++) {
      const slotInfo = getLogicalSlotInfo(i, maxPeriodsPerDay);
      if (slotInfo) {
        headers.push(slotInfo.type === 'break' ? slotInfo.name : `P${slotInfo.period}`);
      }
    }
    return headers;
  }, [totalVisualSlots, maxPeriodsPerDay]);

  return (
    <div className="w-full overflow-x-auto rounded-xl shadow-2xl border border-gray-200">
      <table className="min-w-full w-full bg-white border-collapse table-fixed">
        <thead className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white sticky top-0">
          <tr>
            <th className="p-3 text-left font-extrabold uppercase tracking-wider">Day</th>
            {columnHeaders.map((header, index) => (
              <th key={index} className="p-3 text-center font-extrabold uppercase tracking-wider">
                {String(header).includes('Break') ? String(header).replace(' Break', '') : header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schedule.map(({ day, periods }) => {
            const rowSlots = [];
            let visualIndex = 1;

            while (visualIndex <= totalVisualSlots) {
              const slotInfo = getLogicalSlotInfo(visualIndex, maxPeriodsPerDay);
              if (!slotInfo) { visualIndex++; continue; }

              const scheduledSlot = periods.find(p => {
                if (p.type === 'break') {
                  return slotInfo.type === 'break' && p.name === slotInfo.name;
                }
                return p.type !== 'break' && p.logicalPeriod === slotInfo.logicalPeriod;
              });

              if (scheduledSlot) {
                rowSlots.push(scheduledSlot);
                visualIndex += scheduledSlot.spans;
              } else {
                rowSlots.push({ type: 'free', spans: 1, name: 'Free', teacher: '', room: '', logicalPeriod: slotInfo.logicalPeriod });
                visualIndex++;
              }
            }

            return (
              <tr key={day} className="border-t border-gray-200 hover:bg-indigo-50 transition duration-150">
                <td className="p-3 font-bold text-indigo-700 whitespace-nowrap min-w-[100px]">{day}</td>
                {rowSlots.map((slot, index) => {
                  let style = { bg: 'bg-white', text: 'text-gray-800', icon: '' };

                  if (slot.type === 'break') {
                    if (slot.name.includes('Lunch')) style = { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: 'sandwich' };
                    else style = { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: 'coffee' };
                  }
                  else if (slot.type === 'lab') style = { bg: 'bg-teal-100', text: 'text-teal-800', icon: 'flask-conical' };
                  else if (slot.type === 'theory') style = { bg: 'bg-blue-50', text: 'text-blue-800', icon: 'book' };
                  else if (slot.type === 'free') style = { bg: 'bg-gray-200', text: 'text-gray-500', icon: 'sun' };

                  return (
                    <td key={index} colSpan={slot.spans} className={`p-2 text-center font-medium ${style.bg} ${style.text} border-l border-gray-200 align-top min-w-[140px]`}>
                      <div className="flex flex-col text-sm h-20 justify-center">
                        <div className="flex items-center justify-center font-bold text-base mb-1">
                          {slot.name}
                        </div>
                        {slot.teacher && <span className="text-xs text-gray-600 truncate italic">{slot.teacher}</span>}
                        {slot.room && <span className="text-xs text-gray-500 truncate font-mono">{slot.room}</span>}
                        {slot.startTime && <span className="text-[10px] text-gray-400 mt-0.5">{slot.startTime} - {slot.endTime}</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// --- Main App Component ---
const App = () => {
  const [config, setConfig] = useState(initialConfig);
  // scheduleMap: { divisionName: scheduleArray }
  const [scheduleMap, setScheduleMap] = useState({});
  const [message, setMessage] = useState(null);
  const [resourcesLoaded, setResourcesLoaded] = useState(false);
  const [activeDivision, setActiveDivision] = useState(initialConfig.divisions[0] || 'A');

  // Dynamic Script & Styles Loader (Tailwind and Lucide Icons)
  useEffect(() => {
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    const addStyleLink = (href) => {
      if (document.querySelector(`link[href="${href}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    };

    // Add stable Tailwind prebuilt stylesheet so CSS persists across reloads
    try {
      addStyleLink('https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css');
    } catch (e) {
      console.warn('Could not add tailwind stylesheet link', e);
    }

    // Load lucide UMD bundle
    loadScript("https://unpkg.com/lucide@0.286.0/dist/umd/lucide.js")
      .then(() => {
        setResourcesLoaded(true);
        if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
      })
      .catch(err => console.error("Error loading lucide:", err));
  }, []);

  // Load initial config from local storage
  useEffect(() => {
    const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedData) {
      try {
        const data = JSON.parse(storedData) || {};
        let loadedConfig = data.config || {};

        if (loadedConfig.subjects) {
          loadedConfig.subjects = loadedConfig.subjects.map(s => ({ ...s, faculty: s.faculty || 'Unassigned' }));
        }
        if (loadedConfig.teachers && loadedConfig.teachers.length > MAX_TEACHERS) {
          loadedConfig.teachers = loadedConfig.teachers.slice(0, MAX_TEACHERS);
        }
        if (!loadedConfig.divisions || !Array.isArray(loadedConfig.divisions) || loadedConfig.divisions.length === 0) {
          loadedConfig.divisions = initialConfig.divisions;
        }

        setConfig(prevConfig => ({ ...prevConfig, ...loadedConfig }));
        // schedule may be legacy (array) or map
        if (data.schedule && typeof data.schedule === 'object' && !Array.isArray(data.schedule)) {
          setScheduleMap(data.schedule);
          const firstDiv = (loadedConfig.divisions && loadedConfig.divisions[0]) || Object.keys(data.schedule)[0];
          setActiveDivision(firstDiv);
        } else if (Array.isArray(data.schedule)) {
          // legacy single schedule fallback; map to first division
          const div = loadedConfig.divisions ? loadedConfig.divisions[0] : 'A';
          setScheduleMap({ [div]: data.schedule });
          setActiveDivision(div);
        }
        setMessage({ type: 'success', text: 'Configuration loaded.' });
      } catch (e) {
        console.error("Error loading:", e);
      }
    }
  }, []);

  // --- Handlers ---
  const handleConfigChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => {
      let newValue = type === 'number' ? parseInt(value, 10) : value;
      if (type === 'checkbox') newValue = checked;
      if (name === 'workingDays' || name === 'periodsPerDay' || name === 'semester') {
        newValue = parseInt(value, 10);
      }
      let updatedConfig = { ...prev, [name]: newValue };
      if (name === 'semesterType') {
        const availableSemesters = SEMESTER_MAP[newValue];
        if (!availableSemesters.includes(prev.semester)) {
          updatedConfig.semester = availableSemesters[0];
        }
      }
      return updatedConfig;
    });
    setMessage(null);
  }, []);

  const handleSimpleArrayChange = useCallback((arrayName, index, value) => {
    setConfig(prev => {
      const newArray = [...prev[arrayName]];
      newArray[index] = value;
      return { ...prev, [arrayName]: newArray };
    });
  }, []);

  const addSimpleArrayItem = useCallback((arrayName, defaultValue) => {
    setConfig(prev => {
      if (arrayName === 'teachers' && prev.teachers.length >= MAX_TEACHERS) {
        setMessage({ type: 'warning', text: `Cannot add more than ${MAX_TEACHERS} teachers as per the constraint.` });
        return prev;
      }
      const newArr = [...prev[arrayName], defaultValue];
      return { ...prev, [arrayName]: newArr };
    });
  }, []);

  const removeSimpleArrayItem = useCallback((arrayName, index) => {
    setConfig(prev => {
      const newArr = prev[arrayName].filter((_, i) => i !== index);
      if (arrayName === 'divisions') {
        const newActive = newArr.includes(activeDivision) ? activeDivision : (newArr[0] || 'A');
        setActiveDivision(newActive);
      }
      return { ...prev, [arrayName]: newArr };
    });
    setMessage(null);
  }, [activeDivision]);

  const handleSubjectChange = useCallback((index, field, value) => {
    setConfig(prev => {
      const newSubjects = [...prev.subjects];
      newSubjects[index] = { ...newSubjects[index], [field]: value };
      return { ...prev, subjects: newSubjects };
    });
  }, []);

  const addSubject = useCallback(() => {
    setConfig(prev => ({
      ...prev,
      subjects: [...prev.subjects, { id: Date.now(), name: 'New Subject', type: 'Theory', count: 3, faculty: 'Unassigned' }]
    }));
  }, []);

  const removeSubject = useCallback((index) => {
    setConfig(prev => ({
      ...prev,
      subjects: prev.subjects.filter((_, i) => i !== index)
    }));
  }, []);

  const handleSaveConfig = () => {
    try {
      const dataToSave = { config, schedule: scheduleMap, lastUpdated: new Date().toISOString() };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
      setMessage({ type: 'success', text: 'Configuration saved locally!' });

      // remove focus from active element to avoid any focus-driven scroll/zoom
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error saving configuration.' });
    }
  };

  // Generate timetables for all divisions and store per-division schedules
  const handleGenerateTT = async () => {
    setMessage({ type: 'info', text: 'Generating timetable for all divisions...' });

    // Validate subjects assigned
    const unassigned = config.subjects.find(s => !s.faculty || s.faculty === 'Unassigned');
    if (unassigned) {
      setMessage({ type: 'error', text: `Subject "${unassigned.name}" is unassigned. Please assign faculty.` });
      setScheduleMap({});
      return;
    }

    const newMap = {};
    let overallWarning = '';

    // Global usage tracker across divisions keyed by day -> logicalPeriod -> { faculties: Set, labRooms: Set }
    const globalDayUsage = {};

    // Generate in deterministic order of divisions to keep reproducibility
    const divisionsOrdered = [...config.divisions];
    for (const div of divisionsOrdered) {
      const result = generateTimetable(config, div, globalDayUsage);
      if (result.error) {
        setMessage({ type: 'error', text: result.error });
        setScheduleMap({});
        return;
      }
      newMap[div] = result.schedule;
      if (result.warning) overallWarning += ` Division ${div}: ${result.warning}`;
    }

    setScheduleMap(newMap);
    setActiveDivision(config.divisions[0] || Object.keys(newMap)[0]);

    handleSaveConfig();
    if (overallWarning) {
      setMessage({ type: 'warning', text: overallWarning });
    } else {
      setMessage({ type: 'success', text: 'Timetables generated for all divisions! 🎉' });
    }
  };

  // Derived State
  const currentSemesters = useMemo(() => SEMESTER_MAP[config.semesterType], [config.semesterType]);

  const stats = useMemo(() => {
    const required = config.subjects.reduce((acc, sub) => acc + (sub.count * (sub.type === 'Lab' ? 2 : 1)), 0);
    const available = config.workingDays * config.periodsPerDay;
    return { required, available };
  }, [config.subjects, config.workingDays, config.periodsPerDay]);

  const handleScheduleTypeChange = (type) => {
    setConfig(prev => ({ ...prev, scheduleType: type }));
    setMessage(null);
  };

  const setSemesterType = (type) => {
    setConfig(prev => {
      const availableSemesters = SEMESTER_MAP[type];
      let sem = prev.semester;
      if (!availableSemesters.includes(sem)) sem = availableSemesters[0];
      return { ...prev, semesterType: type, semester: sem };
    });
    setMessage(null);
  };

  const divisionButtons = config.divisions && config.divisions.length > 0
    ? config.divisions
    : ['A'];

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-indigo-50 via-white to-slate-50 font-sans app-container mx-auto overflow-x-hidden max-w-screen-xl">
      <style>
        {`
          html, body, #root { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
          body { overflow-x: hidden; }
          button, input, select, textarea { font-size: 16px; }
          /* Ensure inputs/selects/textareas have white background and black text */
          input, select, textarea {
            background-color: #ffffff !important;
            color: #000000 !important;
            caret-color: #000000 !important;
          }
          button:focus, input:focus, select:focus, textarea:focus { outline: none; box-shadow: none; }
          button:active { transform: none !important; }
          .schedule-button {
            transition: all 0.2s ease;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.04);
            border: 2px solid transparent;
          }
          .schedule-button.active {
            background-color: #4f46e5;
            color: white;
            border-color: #a5b4fc;
            box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.18), 0 4px 6px -2px rgba(79, 70, 229, 0.08);
            transform: translateY(-2px);
          }
          .app-container { padding-left: 16px; padding-right: 16px; box-sizing: border-box; }
          #schedule-container { overflow: visible; }
        `}
      </style>

      <div className="px-4 py-8 sm:px-8 mx-auto  w-full bg-cover">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900">Time Table Generator</h1>
              <p className="text-sm text-gray-500 mt-1">Generate per-division timetables with deterministic shuffling and smart constraints.</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-xs  text-gray-400">Academic Year</div>
              <div className="text-sm text-black font-sbold">{config.academicYear} • {config.branch} • Sem {config.semester} ({config.semesterType})</div>
            </div>
            <button type="button" onClick={handleSaveConfig} className="px-4 py-2 bg-white rounded-lg shadow hover:shadow-lg border border-gray-100 text-black text-sm font-bold focus:outline-none focus:ring-0"> Save</button>
          </div>
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-sm w-full font-medium mb-6 ${message.type === 'error' ? ' w-full bg-red-100 text-red-700' : message.type === 'warning' ? 'bg-yellow-100 w-full text-yellow-700' : 'bg-green-100 text-green-700'}`}>
            {message.text}
          </div>
        )}

        {/* Top Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <h3 className="text-lg font-bold text-indigo-700 mb-4">Academic Setup</h3>
            <div className="space-y-3">
              <Dropdown name="academicYear" label="Academic Year" options={ACADEMIC_YEARS} value={config.academicYear} onChange={handleConfigChange} />
              <div>
                <label className="block text-sm font-medium text-gray-700">Semester</label>
                <div className="mt-2 flex space-x-2">
                  {currentSemesters.map(s => (
                    <button key={s} type="button" onClick={() => handleConfigChange({ target: { name: 'semester', value: s } })} className={`px-3 py-1 rounded-md text-sm border ${config.semester === s ? 'bg-indigo-600 text-black border-indigo-600' : 'bg-white text-black border-gray-200'} focus:outline-none focus:ring-0`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Semester Type</label>
                <div className="flex space-x-2">
                  <button type="button" onClick={() => setSemesterType('Odd')} className={`schedule-button px-3 py-2 rounded-md ${config.semesterType === 'Odd' ? 'active' : 'bg-white text-black'}`}>Odd</button>
                  <button type="button" onClick={() => setSemesterType('Even')} className={`schedule-button px-3 py-2 rounded-md ${config.semesterType === 'Even' ? 'active' : 'bg-white text-black'}`}>Even</button>
                </div>
              </div>

              <Dropdown name="branch" label="Branch" options={BRANCHES} value={config.branch} onChange={handleConfigChange} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <h3 className="text-lg font-bold text-indigo-700 mb-4">Class & Section</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Class No.</label>
                <input type="number" name="classNo" value={config.classNo} onChange={handleConfigChange} min="1" max="8" className="mt-1 block w-full p-2 border border-gray-300 rounded-md" />
              </div>
              <Dropdown name="section" label="Section" options={SECTIONS} value={config.section} onChange={handleConfigChange} />
              <div>
                <label className="block text-sm font-medium text-gray-700">Schedule</label>
                <div className="mt-2 flex space-x-2">
                  <button type="button" onClick={() => handleScheduleTypeChange('Morning')} className={`px-3 py-2 rounded-md text-sm ${config.scheduleType === 'Morning' ? 'bg-indigo-600 text-white' : 'bg-white border text-black border-gray-200'} focus:outline-none focus:ring-0`}>Morning</button>
                  <button type="button" onClick={() => handleScheduleTypeChange('Evening')} className={`px-3 py-2 rounded-md text-sm ${config.scheduleType === 'Evening' ? 'bg-indigo-600 text-white' : 'bg-white border text-black border-gray-200'} focus:outline-none focus:ring-0`}>Evening</button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <h3 className="text-lg font-bold text-indigo-700 mb-4">Rules & Divisions</h3>
            <div className="space-y-3">
              <Dropdown name="workingDays" label="Working Days/Week" options={[1, 2, 3, 4, 5, 6]} value={config.workingDays} onChange={handleConfigChange} />
              <Dropdown name="periodsPerDay" label="Periods/Day" options={PERIOD_OPTIONS} value={config.periodsPerDay} onChange={handleConfigChange} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Divisions (each will get its own TT)</label>
                <SimpleArrayEditor
                  name="divisions"
                  title="Divisions"
                  icon="layers"
                  placeholder="A"
                  data={config.divisions}
                  onChange={handleSimpleArrayChange}
                  onAdd={addSimpleArrayItem}
                  onRemove={removeSimpleArrayItem}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Lists Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <SimpleArrayEditor
            name="teachers"
            title={`Teachers (Max ${MAX_TEACHERS})`}
            icon="users-2"
            placeholder="T-John Doe"
            data={config.teachers}
            onChange={handleSimpleArrayChange}
            onAdd={addSimpleArrayItem}
            onRemove={removeSimpleArrayItem}
          />
          <SimpleArrayEditor
            name="rooms"
            title="Rooms"
            icon="building"
            placeholder="C-101 (Class) / L-201 (Lab)"
            data={config.rooms}
            onChange={handleSimpleArrayChange}
            onAdd={addSimpleArrayItem}
            onRemove={removeSimpleArrayItem}
          />
          <SubjectEditor
            subjects={config.subjects}
            teachers={config.teachers}
            stats={stats}
            onChange={handleSubjectChange}
            onAdd={addSubject}
            onRemove={removeSubject}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-8">
          <button type="button" onClick={handleSaveConfig} className="flex-1 py-3 bg-indigo-500 text-white rounded-lg shadow hover:bg-indigo-600 font-semibold flex justify-center items-center focus:outline-none focus:ring-0">
            <LucideIcon name="save" className="w-5 h-5 mr-2" /> Save Config
          </button>
          <button type="button" onClick={handleGenerateTT} className="flex-1 py-3 bg-emerald-500 text-white rounded-lg shadow hover:bg-emerald-600 font-semibold flex justify-center items-center focus:outline-none focus:ring-0">
            <LucideIcon name="rocket" className="w-5 h-5 mr-2" /> Auto Generate TT for Divisions
          </button>
        </div>

        {/* Division Tabs */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {divisionButtons.map(div => {
              const active = div === activeDivision;
              return (
                <button key={div} type="button" onClick={() => setActiveDivision(div)}
                  className={`px-4 py-2 rounded-full text-sm font-medium ${active ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-700'} focus:outline-none focus:ring-0`}>
                  Division {div}
                </button>
              );
            })}
          </div>
        </div>

        {/* Output - show timetable for active division */}
        <div id="schedule-container" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">Timetable — Division {activeDivision}</h2>
            <div className="text-sm text-gray-500">Periods/Day: {config.periodsPerDay} • Working Days: {config.workingDays}</div>
          </div>

          <TimetableTable schedule={scheduleMap[activeDivision]} maxPeriodsPerDay={config.periodsPerDay} />

          {/* If there are multiple divisions, show a compact grid preview */}
          {Object.keys(scheduleMap).length > 1 && (
            <>
              <h3 className="text-lg font-semibold text-gray-700">Quick previews</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(scheduleMap).map(([div, sched]) => (
                  <div key={div} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold">Division {div}</div>
                      <button type="button" onClick={() => setActiveDivision(div)} className="text-xs text-indigo-600 focus:outline-none focus:ring-0">Open</button>
                    </div>
                    <div className="text-xs text-gray-500">
                      {sched && sched.length ? (
                        <>
                          <div className="mb-2">Mon: {sched[0].periods[0]?.name || '—'}</div>
                          <div>Tue: {sched[1] ? sched[1].periods[0]?.name || '—' : '—'}</div>
                        </>
                      ) : <div className="text-gray-400">No schedule</div>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;