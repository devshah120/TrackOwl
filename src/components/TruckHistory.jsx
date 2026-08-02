import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar, Clock, MapPin, Navigation, Loader2, AlertCircle, Gauge, TrendingUp,
} from 'lucide-react';
import { history as historyApi, tracking } from '../services/api';
import { GoogleFleetMap } from './GoogleFleetMap';

// A day's history is a fixed record, so it is fetched once per date rather than
// polled — unlike the live map, nothing about yesterday changes while you look
// at it. Today is the exception and is refreshed on demand via the date picker.

const fmtDuration = (ms) => {
  const mins = Math.round((ms || 0) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const fmtClock = (iso) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—';

// YYYY-MM-DD for a Date, in local time. `toISOString` would shift the date
// backwards for any timezone ahead of UTC, so IST users would land on yesterday.
const toDateInput = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateInput(d);
};

const fmtDayLabel = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString([], {
    weekday: 'short', day: 'numeric', month: 'short',
  });

export function TruckHistory() {
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [date, setDate] = useState(toDateInput(new Date()));

  const [day, setDay] = useState(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState(null);

  const [range, setRange] = useState({ from: daysAgo(29), to: toDateInput(new Date()) });
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  // Devices, not trucks: position history hangs off the GPS unit, and the truck
  // roster has no link to one.
  useEffect(() => {
    tracking.getDevices()
      .then((r) => {
        const list = r.devices || [];
        setDevices(list);
        setDeviceId((cur) => cur || list[0]?._id || list[0]?.id || '');
      })
      .catch(() => setDevices([]));
  }, []);

  const loadDay = useCallback(async () => {
    if (!deviceId || !date) return;
    setDayLoading(true);
    setDayError(null);
    try {
      setDay(await historyApi.day(deviceId, date));
    } catch (err) {
      setDay(null);
      setDayError(err.message || 'Could not load that day');
    } finally {
      setDayLoading(false);
    }
  }, [deviceId, date]);

  const loadSummary = useCallback(async () => {
    if (!deviceId) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      setSummary(await historyApi.summary(deviceId, range.from, range.to));
    } catch (err) {
      setSummary(null);
      setSummaryError(err.message || 'Could not load the date range');
    } finally {
      setSummaryLoading(false);
    }
  }, [deviceId, range.from, range.to]);

  useEffect(() => { loadDay(); }, [loadDay]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  // Feed the shared fleet map the same shape Trip Routes uses, so the day's
  // path and hold markers render identically to a trip's actual path.
  const mapRoute = useMemo(() => {
    if (!day?.path?.length) return null;
    return {
      actualPath: day.path,
      stops: day.stops || [],
      origin: { lat: day.path[0][0], lng: day.path[0][1] },
      originName: 'First fix of the day',
      destination: {
        lat: day.path[day.path.length - 1][0],
        lng: day.path[day.path.length - 1][1],
      },
      destinationName: 'Last fix of the day',
    };
  }, [day]);

  const fitTo = useMemo(
    () => (day?.path?.length ? day.path.map(([lat, lng]) => ({ lat, lng })) : null),
    [day]
  );

  const s = day?.summary;

  return (
    <div className="space-y-4">
      {/* ---- controls ---------------------------------------------------- */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="min-w-[180px]">
          <label className="mb-1 block text-xs font-medium text-slate-600">Vehicle</label>
          <select
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {devices.length === 0 && <option value="">No GPS devices</option>}
            {devices.map((d) => (
              <option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Date</label>
          <input
            type="date"
            value={date}
            max={toDateInput(new Date())}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-1.5">
          {[
            { label: 'Today', v: toDateInput(new Date()) },
            { label: 'Yesterday', v: daysAgo(1) },
          ].map((q) => (
            <button
              key={q.label}
              onClick={() => setDate(q.v)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                date === q.v
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- day summary tiles ------------------------------------------- */}
      {s && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile icon={Navigation} tone="blue" label="Distance" value={`${s.distanceKm} km`} />
          <Tile icon={Gauge} tone="green" label="Moving" value={fmtDuration(s.movingMs)} />
          <Tile icon={Clock} tone="amber" label="Held / idle" value={fmtDuration(s.idleMs)} />
          <Tile
            icon={MapPin}
            tone="slate"
            label="Hold locations"
            value={String(day.stops?.length || 0)}
          />
        </div>
      )}

      {/* ---- map + hold list --------------------------------------------- */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-lg border border-slate-200">
          {dayLoading && (
            <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/70">
              <span className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
              </span>
            </div>
          )}
          {!dayLoading && !day?.path?.length && (
            <div className="absolute inset-0 z-[400] flex items-center justify-center bg-slate-50">
              <div className="max-w-xs px-4 text-center text-sm text-slate-500">
                <MapPin className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                {dayError || 'No GPS data recorded for this vehicle on this date.'}
              </div>
            </div>
          )}
          <GoogleFleetMap
            devices={[]}
            route={mapRoute}
            fitTo={fitTo}
            fitKey={`${deviceId}_${date}`}
          />
        </div>

        <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white lg:w-80">
          <div className="flex items-center justify-between border-b border-slate-200 p-3">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Clock className="h-4 w-4 text-amber-600" /> Hold locations
            </h3>
            {s && (
              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                {fmtDuration(s.idleMs)} total
              </span>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {!day?.stops?.length ? (
              <p className="p-4 text-xs text-slate-500">
                No holds detected. The vehicle either kept moving or sent no data.
              </p>
            ) : (
              <ul>
                {day.stops.map((st, i) => (
                  <li key={`${st.startedAt}-${i}`} className="flex gap-2.5 border-b border-slate-100 p-3 last:border-b-0">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-800" title={st.address}>
                        {st.address || `${st.lat.toFixed(5)}, ${st.lng.toFixed(5)}`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {fmtClock(st.startedAt)} – {fmtClock(st.endedAt)}
                        <span className="ml-1.5 font-semibold text-amber-700">
                          {fmtDuration(st.durationMs)}
                        </span>
                        {st.inferred && (
                          <span className="ml-1 text-slate-400" title="No GPS reports during this period">
                            · no signal
                          </span>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {s && (
            <div className="border-t border-slate-200 p-3 text-[11px] text-slate-500">
              Tracked {fmtClock(s.firstFixAt)} – {fmtClock(s.lastFixAt)} · {s.fixCount} GPS points
            </div>
          )}
        </div>
      </div>

      {/* ---- date-wise km table ------------------------------------------ */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h3 className="flex items-center gap-1.5 font-semibold text-slate-900">
            <TrendingUp className="h-4 w-4 text-blue-600" /> Date-wise distance
          </h3>
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              className="rounded-lg border border-slate-300 px-2 py-1.5 outline-none focus:border-blue-500"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={range.to}
              min={range.from}
              max={toDateInput(new Date())}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              className="rounded-lg border border-slate-300 px-2 py-1.5 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {summaryError && (
          <p className="flex items-center gap-2 p-4 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" /> {summaryError}
          </p>
        )}

        {summaryLoading ? (
          <p className="flex items-center gap-2 p-4 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : !summary?.days?.length ? (
          <p className="p-4 text-sm text-slate-500">No movement recorded in this range.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <Th>Date</Th>
                    <Th right>Distance</Th>
                    <Th right>Moving</Th>
                    <Th right>Held</Th>
                    <Th right>Holds</Th>
                    <Th right>First – last fix</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.days.map((d) => (
                    <tr
                      key={d.date}
                      onClick={() => setDate(d.date)}
                      className={`cursor-pointer transition hover:bg-blue-50 ${
                        d.date === date ? 'bg-blue-50' : ''
                      }`}
                      title="Show this day on the map"
                    >
                      <td className="px-4 py-2.5 text-sm font-medium text-slate-800">
                        {fmtDayLabel(d.date)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm font-semibold text-blue-700">
                        {d.distanceKm} km
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm text-slate-600">
                        {fmtDuration(d.movingMs)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm text-amber-700">
                        {fmtDuration(d.idleMs)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm text-slate-600">{d.stopCount}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-slate-500">
                        {fmtClock(d.firstFixAt)} – {fmtClock(d.lastFixAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr>
                    <td className="px-4 py-2.5 text-sm font-semibold text-slate-900">
                      Total · {summary.totals.activeDays} active days
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-bold text-blue-700">
                      {summary.totals.distanceKm} km
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-semibold text-slate-700">
                      {fmtDuration(summary.totals.movingMs)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-semibold text-amber-700">
                      {fmtDuration(summary.totals.idleMs)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
              Distance is summed from recorded GPS points. Stretches where the tracker
              was silent are excluded rather than estimated, so totals may read low if a
              device loses signal.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const Th = ({ children, right }) => (
  <th className={`px-4 py-2.5 text-xs font-semibold text-slate-700 ${right ? 'text-right' : 'text-left'}`}>
    {children}
  </th>
);

const TONES = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  amber: 'bg-amber-50 text-amber-600',
  slate: 'bg-slate-100 text-slate-600',
};

const Tile = ({ icon: Icon, tone, label, value }) => (
  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3.5">
    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${TONES[tone]}`}>
      <Icon className="h-4.5 w-4.5" />
    </span>
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="truncate text-lg font-bold text-slate-900">{value}</p>
    </div>
  </div>
);
