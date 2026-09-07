import { MapPin, Users } from 'lucide-react';
import { Card, Detail } from './shared';
import {
  TRIP_TYPE_LABELS, CREW_ROLE_LABELS,
  formatNumber, formatDate, formatDateTime, formatDuration,
} from '../../constants/trip';

// The summary view: everything an operator needs to answer "what is this trip?"
// without opening another tab.
export function TripOverviewTab({ data }) {
  const trip = data.trip;
  const variance = data.variance || {};

  const cargoWeight = (trip.cargo || []).reduce((s, c) => s + (Number(c.weightKg) || 0), 0);
  const cargoQty = (trip.cargo || []).reduce((s, c) => s + (Number(c.quantity) || 0), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card title="Trip">
        <div className="grid grid-cols-2 gap-4">
          <Detail label="Trip Number" value={trip.tripNumber} />
          <Detail label="Trip Date" value={formatDate(trip.tripDate)} />
          <Detail label="Trip Type" value={TRIP_TYPE_LABELS[trip.tripType] || trip.tripType} />
          <Detail label="Created" value={formatDateTime(trip.createdAt)} />
          <Detail
            label="Planned Pickup"
            value={trip.pickupPlannedAt ? formatDateTime(trip.pickupPlannedAt) : null}
          />
          <Detail
            label="Expected Delivery"
            value={trip.destinationExpectedAt ? formatDateTime(trip.destinationExpectedAt) : null}
          />
        </div>
        {trip.notes && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-500 mb-1">Notes</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{trip.notes}</p>
          </div>
        )}
      </Card>

      <Card title="Customer">
        {trip.customer ? (
          <div className="grid grid-cols-2 gap-4">
            <Detail label="Name" value={trip.customer.name} />
            <Detail label="Code" value={trip.customer.code} />
            <Detail label="GSTIN" value={trip.customer.gstin} />
            <Detail label="Payment Terms" value={trip.customer.paymentTerms} />
            <Detail
              label="Credit Limit"
              value={
                trip.customer.creditLimit != null
                  ? `₹${Number(trip.customer.creditLimit).toLocaleString('en-IN')}`
                  : null
              }
            />
            <Detail
              label="Billing Address"
              value={[
                trip.customer.billingAddress?.line1,
                trip.customer.billingAddress?.city,
                trip.customer.billingAddress?.state,
              ].filter(Boolean).join(', ')}
              className="col-span-2"
            />
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No customer is set on this trip yet.</p>
        )}

        {(trip.customerReferences?.po ||
          trip.customerReferences?.bookingNumber ||
          trip.customerReferences?.customerRef ||
          trip.customerReferences?.invoiceRef) && (
          <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 gap-4">
            <Detail label="PO Number" value={trip.customerReferences.po} />
            <Detail label="Booking Number" value={trip.customerReferences.bookingNumber} />
            <Detail label="Customer Reference" value={trip.customerReferences.customerRef} />
            <Detail label="Invoice Reference" value={trip.customerReferences.invoiceRef} />
          </div>
        )}
      </Card>

      <Card title="Route">
        <div className="space-y-4">
          <RouteEnd icon={MapPin} label="Pickup" location={trip.pickup} />
          {(trip.stops || []).length > 0 && (
            <p className="text-sm text-slate-500 pl-7">
              via {trip.stops.length} stop{trip.stops.length === 1 ? '' : 's'}
            </p>
          )}
          <RouteEnd icon={MapPin} label="Destination" location={trip.destination} />
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 gap-4">
          <Detail
            label="Planned Distance"
            value={trip.plannedKm != null ? `${formatNumber(trip.plannedKm)} km` : null}
          />
          <Detail
            label="Actual Distance"
            value={trip.actualKm != null ? `${formatNumber(trip.actualKm)} km` : null}
          />
          <Detail
            label="Planned Time"
            value={trip.plannedMinutes != null ? formatDuration(trip.plannedMinutes) : null}
          />
          <Detail
            label="Actual Time"
            value={trip.actualMinutes != null ? formatDuration(trip.actualMinutes) : null}
          />
          {variance.kmDeviation != null && (
            <Detail
              label="Route Deviation"
              value={`${variance.kmDeviation > 0 ? '+' : ''}${formatNumber(variance.kmDeviation)} km${
                variance.kmDeviationPct != null ? ` (${formatNumber(variance.kmDeviationPct)}%)` : ''
              }`}
            />
          )}
          {variance.averageSpeedKmph != null && (
            <Detail label="Average Speed" value={`${formatNumber(variance.averageSpeedKmph)} km/h`} />
          )}
        </div>
      </Card>

      <Card title="Vehicle & Driver">
        <div className="grid grid-cols-2 gap-4">
          <Detail label="Vehicle" value={trip.vehicleNumber || trip.truck?.number} />
          <Detail label="Model" value={trip.truck?.model} />
          <Detail label="Driver" value={trip.driverName || trip.driver?.name} />
          <Detail label="Driver Mobile" value={trip.driver?.mobile} />
          <Detail label="Licence" value={trip.driver?.licenseNumber} />
          <Detail
            label="Licence Expiry"
            value={trip.driver?.licenseExpiry ? formatDate(trip.driver.licenseExpiry) : null}
          />
        </div>

        {(trip.crew || []).length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-500 mb-2 flex items-center gap-1">
              <Users className="w-4 h-4" /> Crew
            </p>
            <ul className="space-y-1">
              {trip.crew.map((c, i) => (
                <li key={i} className="text-sm text-slate-700">
                  <span className="font-medium">{c.employee?.name || c.name || '—'}</span>
                  <span className="text-slate-500"> · {CREW_ROLE_LABELS[c.role] || c.role}</span>
                  {(c.mobile || c.employee?.mobile) && (
                    <span className="text-slate-500"> · {c.mobile || c.employee?.mobile}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title="Cargo & Consignment">
        <div className="grid grid-cols-2 gap-4">
          <Detail label="Cargo Lines" value={(trip.cargo || []).length || null} />
          <Detail label="Total Quantity" value={cargoQty || null} />
          <Detail label="Total Weight" value={cargoWeight ? `${formatNumber(cargoWeight)} kg` : null} />
          <Detail
            label="Vehicle Capacity"
            value={trip.truck?.capacity?.weightKg ? `${formatNumber(trip.truck.capacity.weightKg)} kg` : null}
          />
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 gap-4">
          <Detail label="LR Number" value={trip.consignment?.lrNumber} />
          <Detail label="E-way Bill" value={trip.consignment?.ewayBill} />
          <Detail label="Invoice Number" value={trip.consignment?.invoiceNumber} />
          <Detail label="Challan Number" value={trip.consignment?.challanNumber} />
          <Detail label="PO Number" value={trip.consignment?.poNumber} />
          <Detail label="Delivery Order" value={trip.consignment?.deliveryOrder} />
        </div>
      </Card>

      <Card title="Execution">
        <div className="grid grid-cols-2 gap-4">
          <Detail label="Started" value={trip.start?.at ? formatDateTime(trip.start.at) : null} />
          <Detail label="Ended" value={trip.end?.at ? formatDateTime(trip.end.at) : null} />
          <Detail
            label="Starting Odometer"
            value={trip.start?.odometer != null ? `${formatNumber(trip.start.odometer)} km` : null}
          />
          <Detail
            label="Final Odometer"
            value={trip.end?.odometer != null ? `${formatNumber(trip.end.odometer)} km` : null}
          />
          <Detail
            label="Starting Fuel"
            value={trip.start?.fuelLevel != null ? `${trip.start.fuelLevel}%` : null}
          />
          <Detail
            label="Final Fuel"
            value={trip.end?.fuelLevel != null ? `${trip.end.fuelLevel}%` : null}
          />
          <Detail
            label="Dispatched"
            value={trip.dispatchedAt ? formatDateTime(trip.dispatchedAt) : null}
          />
          <Detail
            label="POD Captured"
            value={trip.pod?.capturedAt ? formatDateTime(trip.pod.capturedAt) : null}
          />
        </div>
      </Card>
    </div>
  );
}

function RouteEnd({ icon: Icon, label, location }) {
  const lines = [
    location?.address,
    [location?.city, location?.state, location?.pincode].filter(Boolean).join(', '),
  ].filter(Boolean);

  return (
    <div className="flex gap-3">
      <Icon className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="font-medium text-slate-900">
          {location?.name || location?.city || <span className="text-slate-400">Not set</span>}
        </p>
        {lines.map((line, i) => (
          <p key={i} className="text-sm text-slate-600">{line}</p>
        ))}
        {(location?.contactName || location?.contactPhone) && (
          <p className="text-sm text-slate-600 mt-1">
            {location.contactName}
            {location.contactName && location.contactPhone && ' · '}
            {location.contactPhone}
          </p>
        )}
        {location?.notes && <p className="text-sm text-slate-500 mt-1 italic">{location.notes}</p>}
      </div>
    </div>
  );
}
