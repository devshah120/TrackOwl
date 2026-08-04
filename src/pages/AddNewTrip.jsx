import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft, ArrowRight, MapPin, Flag, Navigation, Loader2, Check,
  Route as RouteIcon, Truck, Users, Package, FileText, AlertCircle, X, Clock,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Topbar } from '../components/Topbar';
import { PlaceSearchInput } from '../components/PlaceSearchInput';
import { GoogleFleetMap } from '../components/GoogleFleetMap';
import { billing, drivers as driversApi, trips as tripsApi, tracking, geo, fleet } from '../services/api';

// Dates come back from the API as ISO strings but the <input type="date">
// fields want plain YYYY-MM-DD.
const asDateInput = (value) => (value ? String(value).slice(0, 10) : '');

// Numeric fields render as text inputs, so 0 defaults are shown as empty
// rather than a literal "0" the user has to clear before typing.
const asNumberInput = (value) => (value === 0 || value === undefined || value === null ? '' : String(value));

// Short first segment of a place name ("Mumbai, Maharashtra, India" → "Mumbai").
const shortPlace = (name = '') => name.split(',')[0].trim();

// Roughly mainland India, as a two-corner box. Used as the map's opening view
// before a truck or a From/To point gives it somewhere better to look. Two
// corners rather than one centre point so the map fits a region instead of
// snapping to street-level zoom on an arbitrary spot.
const INDIA_VIEW = {
  sw: { lat: 8.0, lng: 68.5 },
  ne: { lat: 35.5, lng: 89.0 },
};

// Format planned duration in minutes/hours (e.g. ~12 min or ~1h 15m).
const formatDurationMin = (mins) => {
  if (!mins || mins <= 0) return '';
  const total = Math.round(mins);
  if (total < 60) return `~${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
};

// The wizard's steps, in order. `fields` lists the form keys each step owns, so
// a validation failure can be traced back to the step that must be reopened.
const STEPS = [
  { id: 'route', label: 'Route', icon: RouteIcon },
  { id: 'vehicle', label: 'Vehicle & Driver', icon: Truck },
  { id: 'parties', label: 'Trip Details & Parties', icon: Users },
  { id: 'goods', label: 'Goods & Freight', icon: Package },
  { id: 'payment', label: 'Documents & Payment', icon: FileText },
];

// Shared input styling — every field on the form uses it, so it lives in one
// place rather than being repeated on each element.
const INPUT = 'w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
const READONLY = 'w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600';
const LABEL = 'block text-sm font-medium text-slate-700 mb-2';

export function AddNewTrip() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { user, logout } = useAuth();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [stepError, setStepError] = useState('');

  // --- Route picking -------------------------------------------------------
  // From/To are real places ({ name, lat, lng }) rather than one free-text
  // string, so the trip can be drawn on the map and matched to live GPS.
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routing, setRouting] = useState(false);
  const [pickingTarget, setPickingTarget] = useState(null); // 'origin' | 'destination' | null
  const [geocodingPick, setGeocodingPick] = useState(false);

  // GPS devices, so the trip can be tracked once it is running.
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState('');

  // The truck roster. A truck now carries its own `device` ref, so choosing a
  // truck is what selects the tracker — the two are no longer matched by name.
  const [trucks, setTrucks] = useState([]);
  const [truckId, setTruckId] = useState('');

  // An edited trip's saved truck number, held until the roster loads so the
  // dropdown can be matched back to it. A ref rather than a read of `formData`,
  // which is declared below the effect that needs this.
  const savedTruckNumberRef = useRef('');

  // The real driver roster. A truck can carry several drivers, so this lists
  // every driver the client has and shows which truck each is assigned to —
  // picking one fills in the truck as well.
  const [drivers, setDrivers] = useState([]);
  const [driversError, setDriversError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await driversApi.list();
        if (cancelled) return;
        setDrivers(
          res.drivers.map((d) => {
            // `truck` comes back populated on the list endpoint, but tolerate a
            // bare id so the filter below still works either way.
            const truck = d.truck;
            const truckRef = truck && typeof truck === 'object' ? (truck._id || truck.id) : truck;
            return {
              id: d._id || d.id,
              name: d.name,
              mobile: d.mobile || '',
              salary: d.salary,
              licenseNumber: d.licenseNumber || '',
              licenseExpiry: d.licenseExpiry ? d.licenseExpiry.slice(0, 10) : '',
              truckId: truckRef ? String(truckRef) : '',
              truckNumber: (truck && typeof truck === 'object' ? truck.number : '') || '',
              truckModel: (truck && typeof truck === 'object' ? truck.model : '') || '',
              isPrimary: d.isPrimary,
            };
          })
        );
      } catch (err) {
        if (!cancelled) setDriversError(err.message || 'Failed to load drivers');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Trackers are optional for the paperwork, so a failure here is silent — it
  // only means the trip won't be live-trackable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await tracking.getDevices();
        if (!cancelled) setDevices(res.devices || []);
      } catch {
        if (!cancelled) setDevices([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // The truck roster, each with the GPS unit fitted to it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fleet.list();
        if (cancelled) return;
        setTrucks(
          (res.trucks || []).map((t) => {
            // `device` is populated on some responses and a bare id on others.
            const dev = t.device;
            const devId = dev && typeof dev === 'object' ? (dev._id || dev.id) : dev;
            return {
              id: t._id || t.id,
              number: t.number,
              model: t.model || '',
              deviceId: devId ? String(devId) : '',
              deviceName: dev && typeof dev === 'object' ? dev.name : '',
            };
          })
        );
      } catch {
        if (!cancelled) setTrucks([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Editing an existing trip: pull the saved record and refill the whole form,
  // so the same page serves both "create" and "edit" rather than a cut-down
  // modal that could only reach a handful of fields.
  const [loadingTrip, setLoadingTrip] = useState(isEditing);

  // The route record this billing trip is linked to, if it was created through
  // the wizard. Kept so an edit updates that trip instead of orphaning it.
  const [linkedTripRoute, setLinkedTripRoute] = useState(null);

  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await billing.list();
        const trip = res.billingTrips.find((t) => (t._id || t.id) === id);
        if (cancelled) return;
        if (!trip) {
          setSaveError('That trip could not be found.');
          return;
        }

        const r = trip.references || {};
        const g = trip.goods || {};
        const p = trip.payment || {};

        setLinkedTripRoute(trip.tripRoute || null);
        if (trip.device) setDeviceId(String(trip.device));
        // Matched against the truck roster once it loads, to preselect the
        // Route step's truck dropdown.
        savedTruckNumberRef.current = String(trip.truck || '');

        // Prefer the saved coordinates; fall back to the plain strings so a
        // trip created before map picking existed still shows its From/To
        // (without a pin, since there is no coordinate to place one at).
        if (trip.originPlace?.lat != null) {
          setOrigin(trip.originPlace);
        } else if (trip.fromLocation) {
          setOrigin({ name: trip.fromLocation, lat: null, lng: null });
        }
        if (trip.destinationPlace?.lat != null) {
          setDestination(trip.destinationPlace);
        } else if (trip.toLocation) {
          setDestination({ name: trip.toLocation, lat: null, lng: null });
        }

        setFormData((prev) => ({
          ...prev,
          tripDate: asDateInput(trip.date),
          truckNumber: trip.truck || '',
          driverName: trip.driver?.name || '',
          driverMobile: trip.driver?.mobile || '',
          driverLicenseNumber: trip.driver?.licenseNumber || '',
          loadingDate: asDateInput(trip.loadingDate),
          deliveryDate: asDateInput(trip.deliveryDate),

          lrNumber: trip.lr || '',
          billNumber: trip.bill || '',
          invoiceNo: trip.invoiceNo || '',
          gstPayableBy: trip.gstPayableBy || 'Consignee',
          lrCharges: asNumberInput(trip.lrCharges),
          gstRate: asNumberInput(trip.gstRate),

          deliveryNote: r.deliveryNote || '',
          paymentTerms: r.paymentTerms || '',
          supplierRef: r.supplierRef || '',
          otherRef: r.otherRef || '',
          buyerOrderNo: r.buyerOrderNo || '',
          buyerOrderDate: r.buyerOrderDate || '',
          despatchDocNo: r.despatchDocNo || '',
          deliveryNoteDate: r.deliveryNoteDate || '',
          despatchedThrough: r.despatchedThrough || '',
          destination: r.destination || '',
          termsOfDelivery: r.termsOfDelivery || '',

          supplierName: trip.consignor?.name || '',
          supplierGst: trip.consignor?.gst || '',
          supplierAddress: trip.consignor?.address || '',
          supplierContact: trip.consignor?.contact || '',

          buyerName: trip.consignee?.name || trip.partyName || '',
          buyerGst: trip.consignee?.gst || '',
          buyerAddress: trip.consignee?.address || '',
          buyerContact: trip.consignee?.contact || '',

          goodsDescription: g.description || '',
          quantity: asNumberInput(g.quantity),
          unit: g.unit || 'Kg',
          totalWeight: asNumberInput(g.weight),
          weightUnit: g.weightUnit || 'Kg',
          declaredValue: asNumberInput(g.declaredValue),
          freightRate: asNumberInput(g.freightRate),
          totalFreightAmount: asNumberInput(trip.amount),

          paymentMethod: p.method || 'Bank Transfer',
          // Status on the record is payment state; this form words fully paid
          // as "Completed" (see toBillingStatus).
          paymentStatus: trip.status === 'Paid' ? 'Completed' : trip.status || 'Pending',
          advanceAmount: asNumberInput(p.advance),
          balanceAmount: asNumberInput(p.balance),
          paymentNotes: p.notes || '',
        }));
      } catch (err) {
        if (!cancelled) setSaveError(err.message || 'Failed to load trip');
      } finally {
        if (!cancelled) setLoadingTrip(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEditing]);

  useEffect(() => {
    if (!isEditing || !trucks.length || truckId) return;
    const wanted = savedTruckNumberRef.current.replace(/[\s-]/g, '').toUpperCase();
    if (!wanted) return;
    const match = trucks.find(
      (t) => String(t.number).replace(/[\s-]/g, '').toUpperCase() === wanted
    );
    if (!match) return;
    setTruckId(match.id);
    // Only adopt the truck's tracker if the saved trip had none of its own —
    // the record's own device is the authority for a trip already created.
    setDeviceId((prev) => prev || match.deviceId || '');
  }, [isEditing, trucks, truckId, loadingTrip]);

  // The saved trip stores the driver's details, not which roster entry they
  // came from. Once both have loaded, match them back up so the dropdown shows
  // the right driver instead of sitting blank on an otherwise filled form.
  useEffect(() => {
    if (!isEditing || !drivers.length) return;
    setFormData((prev) => {
      if (prev.driverId || !prev.driverName) return prev;
      const match = drivers.find(
        (d) =>
          d.name === prev.driverName &&
          (!prev.driverMobile || d.mobile === prev.driverMobile)
      );
      return match ? { ...prev, driverId: match.id } : prev;
    });
  }, [drivers, isEditing]);

  // Form state
  const [formData, setFormData] = useState({
    // Basic Trip Information
    tripDate: '',
    truckNumber: '',
    driverId: '',
    driverName: '',
    driverMobile: '',
    driverLicenseNumber: '',
    loadingDate: '',
    deliveryDate: '',
    status: 'In Transit',

    // Document references printed on the LR / invoice.
    lrNumber: '',
    billNumber: '',
    invoiceNo: '',
    gstPayableBy: 'Consignee',
    lrCharges: '',
    gstRate: '',

    // Reference boxes across the head of the tax invoice.
    deliveryNote: '',
    paymentTerms: '',
    supplierRef: '',
    otherRef: '',
    buyerOrderNo: '',
    buyerOrderDate: '',
    despatchDocNo: '',
    deliveryNoteDate: '',
    despatchedThrough: '',
    destination: '',
    termsOfDelivery: '',

    // Party Details - Supplier
    supplierName: '',
    supplierGst: '',
    supplierAddress: '',
    supplierContact: '',

    // Party Details - Buyer
    buyerName: '',
    buyerGst: '',
    buyerAddress: '',
    buyerContact: '',

    // Goods Details
    goodsDescription: '',
    quantity: '',
    unit: 'Kg',
    totalWeight: '',
    weightUnit: 'Kg',
    declaredValue: '',
    freightRate: '',
    totalFreightAmount: '',

    // Payment Details
    paymentMethod: 'Bank Transfer',
    paymentStatus: 'Pending',
    advanceAmount: '',
    balanceAmount: '',
    paymentNotes: '',
  });

  const selectedTruck = useMemo(
    () => trucks.find((t) => t.id === truckId) || null,
    [trucks, truckId]
  );

  // Only the drivers assigned to the truck chosen on the Route step — picking a
  // driver from some other vehicle would put the wrong name on the Lorry
  // Receipt. Primary driver first, so the usual choice is at the top.
  const truckDrivers = useMemo(() => {
    if (!truckId) return [];
    return drivers
      .filter((d) => d.truckId === truckId)
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  }, [drivers, truckId]);

  // The tracker fitted to the chosen truck, if it has reported a position.
  // Drives both the "Use my location" button and the marker on the map.
  const selectedDevice = useMemo(
    () => devices.find((d) => (d._id || d.id) === deviceId) || null,
    [devices, deviceId]
  );
  const deviceHasFix = Boolean(selectedDevice?.lastPosition?.latitude);

  // Choosing a truck selects its tracker, fills the truck number for the
  // paperwork, and — the point of having it on this step — lets the map show
  // where that vehicle actually is.
  const handleTruckChange = (nextId) => {
    setTruckId(nextId);
    const truck = trucks.find((t) => t.id === nextId);
    setDeviceId(truck?.deviceId || '');
    setFormData((prev) => {
      // A driver belongs to one truck, so a driver already chosen for the
      // previous truck must not survive the change — leaving them selected
      // would print the wrong name on the Lorry Receipt.
      const keepDriver = prev.driverId
        && drivers.some((d) => d.id === prev.driverId && d.truckId === nextId);
      return {
        ...prev,
        truckNumber: truck?.number || '',
        ...(keepDriver
          ? {}
          : { driverId: '', driverName: '', driverMobile: '', driverLicenseNumber: '' }),
      };
    });
  };

  // Both endpoints have real coordinates — the condition for drawing a road
  // route and for creating the linked trip record.
  const hasCoords = Boolean(
    origin?.lat != null && origin?.lng != null &&
    destination?.lat != null && destination?.lng != null
  );

  // Recompute the road route whenever both endpoints are set.
  useEffect(() => {
    if (!hasCoords) {
      setRouteInfo(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setRouting(true);
    geo.getRoute(origin, destination, { signal: controller.signal })
      .then((r) => { if (!cancelled) setRouteInfo(r); })
      .catch((err) => {
        if (err.name !== 'AbortError' && !cancelled) setRouteInfo(null);
      })
      .finally(() => { if (!cancelled) setRouting(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [hasCoords, origin, destination]);

  // Clicking the map fills whichever endpoint is being picked, then advances to
  // the other one so From and To can be set in two clicks.
  const handleMapClick = async ({ lat, lng }) => {
    let target = pickingTarget;
    if (!target) {
      if (!origin) target = 'origin';
      else if (!destination) target = 'destination';
      else return; // Both set and nothing is being picked — ignore stray clicks.
    }

    setGeocodingPick(true);
    setStepError('');
    try {
      const place = await geo.reverseGeocode({ lat, lng });
      if (target === 'origin') {
        setOrigin(place);
        setPickingTarget(destination ? null : 'destination');
      } else {
        setDestination(place);
        setPickingTarget(null);
      }
    } catch (err) {
      setStepError(err.message || 'Could not resolve an address for that point.');
    } finally {
      setGeocodingPick(false);
    }
  };

  // "Use my location" on the From field: prefer the selected vehicle's own last
  // GPS fix, since that is where the truck actually is. Falls back to the
  // browser's geolocation (PlaceSearchInput's default) when no device is
  // selected or it has never reported.
  const handleUseVehicleLocation = async () => {
    const pos = selectedDevice?.lastPosition;
    if (!pos?.latitude || !pos?.longitude) {
      throw new Error(
        selectedDevice
          ? `No GPS location recorded for ${selectedDevice.name || 'this vehicle'} yet.`
          : 'Choose a truck with a tracker first, or search for the location.'
      );
    }
    return geo.reverseGeocode({ lat: pos.latitude, lng: pos.longitude });
  };

  // Frame the map on whichever endpoints are set. With neither set yet, fall
  // back to the chosen vehicle so selecting a truck moves the map to where it
  // is — which is usually where the trip starts.
  //
  // Falls back to the country view rather than null: the map only frames itself
  // when it is given points, so handing it nothing leaves an unpainted grey
  // panel until the first truck is picked.
  const framePoints = useMemo(() => {
    const pts = [];
    if (origin?.lat != null) pts.push({ lat: origin.lat, lng: origin.lng });
    if (destination?.lat != null) pts.push({ lat: destination.lat, lng: destination.lng });
    if (pts.length) return pts;
    if (deviceHasFix) {
      return [{
        lat: selectedDevice.lastPosition.latitude,
        lng: selectedDevice.lastPosition.longitude,
      }];
    }
    return [INDIA_VIEW.sw, INDIA_VIEW.ne];
  }, [origin, destination, deviceHasFix, selectedDevice]);

  // Names what the map is currently framing. The component's default key is the
  // number of points, and the opening country view is two points just as a
  // From+To pair is — without this they would collide and the map would refuse
  // to re-frame once both endpoints were picked.
  const frameKey = useMemo(() => {
    const o = origin?.lat != null ? `${origin.lat},${origin.lng}` : '';
    const d = destination?.lat != null ? `${destination.lat},${destination.lng}` : '';
    if (o || d) return `route_${o}_${d}`;
    if (deviceHasFix) return `vehicle_${deviceId}`;
    return 'default';
  }, [origin, destination, deviceHasFix, deviceId]);

  const mapRoute = useMemo(() => ({
    polyline: routeInfo?.polyline || null,
    origin: origin?.lat != null ? { lat: origin.lat, lng: origin.lng } : null,
    originName: origin?.name || 'From',
    destination: destination?.lat != null ? { lat: destination.lat, lng: destination.lng } : null,
    destinationName: destination?.name || 'To',
  }), [routeInfo, origin, destination]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDriverChange = (e) => {
    const driverId = e.target.value;
    const selectedDriver = drivers.find((d) => d.id === driverId);

    // The truck is chosen explicitly on the Route step (it drives the map), so
    // it is deliberately not overwritten here — a driver's usual truck is not
    // necessarily the one running this trip.
    if (selectedDriver) {
      setFormData((prev) => ({
        ...prev,
        driverId,
        driverName: selectedDriver.name,
        driverMobile: selectedDriver.mobile,
        driverLicenseNumber: selectedDriver.licenseNumber,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        driverId: '',
        driverName: '',
        driverMobile: '',
        driverLicenseNumber: '',
      }));
    }
  };

  const handleCalculateFreight = () => {
    const quantity = parseFloat(formData.quantity) || 0;
    const rate = parseFloat(formData.freightRate) || 0;
    setFormData((prev) => ({ ...prev, totalFreightAmount: (quantity * rate).toFixed(2) }));
  };

  const handleCalculateBalance = () => {
    const totalFreight = parseFloat(formData.totalFreightAmount) || 0;
    const advance = parseFloat(formData.advanceAmount) || 0;
    const balance = totalFreight - advance;
    setFormData((prev) => ({ ...prev, balanceAmount: balance < 0 ? 0 : balance.toFixed(2) }));
  };

  // The billing record only tracks payment state, so the trip's own
  // In Transit/Delivered status is not what the Status column shows —
  // Payment Status is. 'Completed' is that form's wording for fully paid.
  const toBillingStatus = (paymentStatus) =>
    paymentStatus === 'Completed' ? 'Paid' : paymentStatus === 'Partial' ? 'Partial' : 'Pending';

  // What each step requires before the user may move past it. Returning a
  // message rather than a boolean means the same check drives both the guard
  // and the text explaining why the button did nothing.
  const validateStep = (index) => {
    if (index === 0) {
      if (!truckId) return 'Choose the truck making this trip.';
      if (!origin) return 'Choose where the trip starts from.';
      if (!destination) return 'Choose where the trip is going to.';
      return '';
    }
    if (index === 1) {
      if (!formData.driverId) return 'Select the driver for this trip.';
      return '';
    }
    if (index === 2) {
      if (!formData.tripDate) return 'Enter the trip date.';
      if (!formData.loadingDate) return 'Enter the loading date.';
      if (!formData.deliveryDate) return 'Enter the delivery date.';
      if (!formData.supplierName.trim()) return 'Enter the supplier (consignor) name.';
      if (!formData.buyerName.trim()) return 'Enter the buyer (consignee) name.';
      return '';
    }
    if (index === 3) {
      if (!formData.goodsDescription.trim()) return 'Describe the goods being carried.';
      if (!formData.quantity) return 'Enter the quantity.';
      if (!formData.totalWeight) return 'Enter the total weight.';
      if (!formData.declaredValue) return 'Enter the declared value.';
      if (!formData.freightRate) return 'Enter the freight rate.';
      return '';
    }
    return '';
  };

  const goNext = () => {
    const problem = validateStep(step);
    if (problem) {
      setStepError(problem);
      return;
    }
    setStepError('');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setStepError('');
    setStep((s) => Math.max(s - 1, 0));
  };

  // Jumping straight to a step from the stepper. Moving backwards is always
  // allowed; moving forwards has to clear every step in between, so a later
  // step can never be reached with earlier ones left incomplete.
  const goToStep = (target) => {
    if (target <= step) {
      setStepError('');
      setStep(target);
      return;
    }
    for (let i = step; i < target; i++) {
      const problem = validateStep(i);
      if (problem) {
        setStepError(problem);
        setStep(i);
        return;
      }
    }
    setStepError('');
    setStep(target);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveError('');

    // Re-check every step, not just the current one — the stepper allows
    // jumping back, so an earlier step could have been emptied after passing.
    for (let i = 0; i < STEPS.length; i++) {
      const problem = validateStep(i);
      if (problem) {
        setStep(i);
        setStepError(problem);
        return;
      }
    }

    // Freight total is filled by the Calculate button; fall back to
    // quantity × rate so a trip is never saved with a zero amount.
    const amount =
      parseFloat(formData.totalFreightAmount) ||
      (parseFloat(formData.quantity) || 0) * (parseFloat(formData.freightRate) || 0);

    if (!amount) {
      setSaveError('Enter a freight rate and quantity, or click "Calculate Total Freight".');
      return;
    }

    setSaving(true);
    try {
      // Create the route record first. It is what makes the trip appear on
      // Trip Routes and gives live tracking something to follow — but it needs
      // both a tracker and real coordinates, so a trip without either is saved
      // as paperwork only rather than being refused.
      let tripRouteId = linkedTripRoute;
      if (!isEditing && hasCoords && deviceId) {
        try {
          const routeRes = await tripsApi.create({
            deviceId,
            origin,
            destination,
            routePolyline: routeInfo?.polyline,
            distanceKm: routeInfo?.distanceKm,
            durationMin: routeInfo?.durationMin,
          });
          tripRouteId = routeRes.trip?.id || routeRes.trip?._id || null;
        } catch (err) {
          // The paperwork is the point of this form; losing the map route is a
          // degradation, not a reason to discard everything the user typed.
          console.error('[trip] route record failed:', err.message);
        }
      }

      const payload = {
        truck: formData.truckNumber,
        partyName: formData.buyerName,
        amount,
        date: formData.tripDate,
        status: toBillingStatus(formData.paymentStatus),

        lr: formData.lrNumber,
        bill: formData.billNumber,
        invoiceNo: formData.invoiceNo,
        fromLocation: origin?.name || '',
        toLocation: destination?.name || '',
        // Coordinates ride alongside the printed names so the trip can be
        // re-drawn on the map when it is edited later.
        originPlace: origin?.lat != null ? origin : null,
        destinationPlace: destination?.lat != null ? destination : null,
        tripRoute: tripRouteId,
        device: deviceId || null,
        gstPayableBy: formData.gstPayableBy,
        lrCharges: formData.lrCharges,
        gstRate: formData.gstRate,
        references: {
          deliveryNote: formData.deliveryNote,
          paymentTerms: formData.paymentTerms || formData.paymentMethod,
          supplierRef: formData.supplierRef,
          otherRef: formData.otherRef,
          buyerOrderNo: formData.buyerOrderNo,
          buyerOrderDate: formData.buyerOrderDate,
          despatchDocNo: formData.despatchDocNo,
          deliveryNoteDate: formData.deliveryNoteDate,
          despatchedThrough: formData.despatchedThrough || formData.truckNumber,
          destination: formData.destination,
          termsOfDelivery: formData.termsOfDelivery,
        },
        loadingDate: formData.loadingDate,
        deliveryDate: formData.deliveryDate,

        consignor: {
          name: formData.supplierName,
          gst: formData.supplierGst,
          address: formData.supplierAddress,
          contact: formData.supplierContact,
        },
        consignee: {
          name: formData.buyerName,
          gst: formData.buyerGst,
          address: formData.buyerAddress,
          contact: formData.buyerContact,
        },
        goods: {
          description: formData.goodsDescription,
          quantity: formData.quantity,
          unit: formData.unit,
          weight: formData.totalWeight,
          weightUnit: formData.weightUnit,
          declaredValue: formData.declaredValue,
          freightRate: formData.freightRate,
        },
        driver: {
          name: formData.driverName,
          mobile: formData.driverMobile,
          licenseNumber: formData.driverLicenseNumber,
        },
        payment: {
          method: formData.paymentMethod,
          advance: formData.advanceAmount,
          balance: formData.balanceAmount,
          notes: formData.paymentNotes,
        },
      };

      if (isEditing) {
        await billing.update(id, payload);
      } else {
        await billing.create(payload);
      }
      navigate('/trips-and-documents');
    } catch (err) {
      setSaveError(err.message || (isEditing ? 'Failed to save trip' : 'Failed to create trip'));
      setSaving(false);
    }
  };

  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full max-w-6xl mx-auto space-y-6">
          {/* Header with Back Button */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/trips-and-documents')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {isEditing ? 'Edit Trip' : 'Add New Trip'}
              </h1>
              <p className="text-slate-600 mt-1">
                {isEditing
                  ? 'Update any detail of this trip, its documents, or its payment'
                  : `Step ${step + 1} of ${STEPS.length} — ${STEPS[step].label}`}
              </p>
            </div>
          </div>

          {loadingTrip && (
            <div className="text-center py-12 text-slate-500">Loading trip...</div>
          )}

          <div className={loadingTrip ? 'hidden' : ''}>
            {/* Stepper. Doubles as navigation: a completed step can be
                reopened without walking back through the ones after it. */}
            <nav aria-label="Progress" className="mb-6">
              <ol className="flex flex-wrap items-center gap-y-3">
                {STEPS.map((s, i) => {
                  const Icon = s.icon;
                  const done = i < step;
                  const current = i === step;
                  return (
                    <li key={s.id} className="flex flex-1 min-w-[9rem] items-center">
                      <button
                        type="button"
                        onClick={() => goToStep(i)}
                        className="group flex items-center gap-2 text-left"
                        aria-current={current ? 'step' : undefined}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition ${
                            current
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : done
                              ? 'border-blue-600 bg-white text-blue-600'
                              : 'border-slate-200 bg-white text-slate-400 group-hover:border-slate-300'
                          }`}
                        >
                          {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                        </span>
                        <span
                          className={`hidden text-sm font-medium sm:block ${
                            current ? 'text-slate-900' : done ? 'text-slate-700' : 'text-slate-400'
                          }`}
                        >
                          {s.label}
                        </span>
                      </button>
                      {i < STEPS.length - 1 && (
                        <span
                          className={`mx-2 hidden h-0.5 flex-1 rounded sm:block ${
                            done ? 'bg-blue-600' : 'bg-slate-200'
                          }`}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* ---------- Step 1: Route ---------- */}
              {step === 0 && (
                <div className="space-y-6">
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="p-6 pb-4">
                      <h2 className="text-lg font-semibold text-slate-900">Where is this trip going?</h2>
                      <p className="text-sm text-slate-500 mt-1">
                        Search for a place, or pick From and To directly on the map.
                      </p>
                    </div>

                    {/* The route step is the whole page: the fields sit in a
                        narrow column and the map takes all the width left, so
                        picking a point is done on a map big enough to see. */}
                    <div className="flex flex-col lg:flex-row lg:items-stretch">
                      {/* Left: vehicle, then the two location fields */}
                      <div className="space-y-4 px-6 pb-6 lg:w-[22rem] lg:shrink-0">
                        {/* Choosing the truck here (rather than two steps later)
                            is what makes "Use my location" meaningful — it
                            resolves to this vehicle's own last GPS fix. */}
                        <div>
                          <label className={LABEL}>Truck</label>
                          <select
                            value={truckId}
                            onChange={(e) => handleTruckChange(e.target.value)}
                            className={INPUT}
                            disabled={isEditing}
                          >
                            <option value="">
                              {trucks.length ? 'Choose a truck…' : 'No trucks yet'}
                            </option>
                            {trucks.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.number}
                                {t.deviceName ? ` — ${t.deviceName}` : ' — no tracker'}
                              </option>
                            ))}
                          </select>
                          {selectedTruck && !selectedTruck.deviceId && (
                            <p className="mt-1 text-xs text-amber-700">
                              This truck has no GPS tracker, so the trip won't be live-trackable.
                            </p>
                          )}
                          {selectedTruck?.deviceId && !deviceHasFix && (
                            <p className="mt-1 text-xs text-amber-700">
                              {selectedTruck.deviceName} hasn't reported a position yet.
                            </p>
                          )}
                        </div>

                        <PlaceSearchInput
                          label="From"
                          placeholder="Start location, e.g. Mumbai"
                          value={origin}
                          onSelect={(place) => { setOrigin(place); setPickingTarget(null); }}
                          icon={MapPin}
                          allowCurrentLocation
                          onUseCurrentLocation={handleUseVehicleLocation}
                          allowMapPick
                          onPickOnMap={() =>
                            setPickingTarget(pickingTarget === 'origin' ? null : 'origin')
                          }
                          isPickingOnMap={pickingTarget === 'origin'}
                        />

                        <PlaceSearchInput
                          label="To"
                          placeholder="Destination, e.g. Pune"
                          value={destination}
                          onSelect={(place) => { setDestination(place); setPickingTarget(null); }}
                          icon={Flag}
                          allowMapPick
                          onPickOnMap={() =>
                            setPickingTarget(pickingTarget === 'destination' ? null : 'destination')
                          }
                          isPickingOnMap={pickingTarget === 'destination'}
                        />

                        <p className="flex items-start gap-1.5 rounded-lg border border-sky-100 bg-sky-50 p-2.5 text-xs text-slate-600">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                          <span>
                            Tip: Click <strong>Pick on map</strong> or click anywhere directly on the
                            map to choose From and To locations.
                          </span>
                        </p>

                        {/* Route summary, once both ends are known */}
                        {hasCoords && (
                          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                            {routing ? (
                              <span className="flex items-center gap-2">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculating road route…
                              </span>
                            ) : routeInfo ? (
                              <span className="flex items-center gap-3 font-medium text-slate-700">
                                <span className="flex items-center gap-1">
                                  <Navigation className="h-3.5 w-3.5 text-sky-500" />
                                  {routeInfo.distanceKm} km
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {formatDurationMin(routeInfo.durationMin)}
                                </span>
                              </span>
                            ) : (
                              <span>Route service unavailable — the trip can still be saved.</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: the map. Google Maps sizes itself to its
                          container, so that container needs a real height —
                          set in pixels here, the same way FleetMapWidget does
                          it. A percentage height would have nothing to resolve
                          against in this grid row and collapse to zero. */}
                      <div
                        className="relative w-full min-w-0 flex-1 border-t border-slate-200 lg:border-l lg:border-t-0"
                        style={{ height: 560 }}
                      >
                        <GoogleFleetMap
                          devices={selectedDevice ? [selectedDevice] : []}
                          selectedId={deviceId || null}
                          route={mapRoute}
                          fitTo={framePoints}
                          onClick={handleMapClick}
                          pickingMode={Boolean(pickingTarget)}
                        />

                        {/* Picking prompt over the map */}
                        <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2">
                          {geocodingPick ? (
                            <div className="flex items-center gap-2 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-white shadow-md">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="font-medium">Finding location address…</span>
                            </div>
                          ) : pickingTarget === 'origin' ? (
                            <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm text-white shadow-lg">
                              <MapPin className="h-4 w-4" />
                              <span className="font-medium">Click on map to select "From"</span>
                              <button
                                type="button"
                                onClick={() => setPickingTarget(null)}
                                className="ml-1 rounded-full p-0.5 hover:bg-emerald-700"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : pickingTarget === 'destination' ? (
                            <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm text-white shadow-lg">
                              <Flag className="h-4 w-4" />
                              <span className="font-medium">Click on map to select "To"</span>
                              <button
                                type="button"
                                onClick={() => setPickingTarget(null)}
                                className="ml-1 rounded-full p-0.5 hover:bg-rose-700"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : origin || destination ? (
                            <div className="flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm shadow-md">
                              {origin ? (
                                <>
                                  <MapPin className="h-4 w-4 text-green-600" />
                                  <span className="font-medium text-slate-900">
                                    {shortPlace(origin.name)}
                                  </span>
                                </>
                              ) : (
                                <span className="text-slate-400">Set From</span>
                              )}
                              <Navigation className="h-4 w-4 text-sky-500" />
                              {destination ? (
                                <>
                                  <Flag className="h-4 w-4 text-red-600" />
                                  <span className="font-medium text-slate-900">
                                    {shortPlace(destination.name)}
                                  </span>
                                </>
                              ) : (
                                <span className="text-slate-400">Set To</span>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* ---------- Step 2: Vehicle & Driver ---------- */}
              {step === 1 && (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h2 className="text-lg font-semibold text-slate-900 mb-1">Vehicle &amp; Driver Details</h2>
                  <p className="text-sm text-slate-500 mb-4">
                    {selectedTruck
                      ? `Drivers assigned to ${selectedTruck.number}. Picking one fills in their mobile and licence for the Lorry Receipt.`
                      : 'Picking a driver fills in their mobile and licence for the Lorry Receipt.'}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className={LABEL}>Select Driver</label>
                      <select
                        name="driverId"
                        value={formData.driverId}
                        onChange={handleDriverChange}
                        className={INPUT}
                        disabled={!truckId}
                      >
                        {/* Scoped to the chosen truck, so the truck number is no
                            longer needed to tell one driver from another. */}
                        <option value="">
                          {!truckId
                            ? 'Choose a truck on the Route step first'
                            : truckDrivers.length
                            ? 'Choose a driver...'
                            : `No drivers assigned to ${selectedTruck?.number || 'this truck'}`}
                        </option>
                        {truckDrivers.map((driver) => (
                          <option key={driver.id} value={driver.id}>
                            {driver.name}
                            {driver.isPrimary ? ' — primary' : ''}
                          </option>
                        ))}
                      </select>
                      {driversError && <p className="mt-1 text-xs text-red-600">{driversError}</p>}
                      {truckId && !truckDrivers.length && !driversError && (
                        <p className="mt-1 text-xs text-amber-700">
                          Assign a driver to this truck under Fleet Management first.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={LABEL}>Driver Name</label>
                      <input type="text" name="driverName" value={formData.driverName} readOnly className={READONLY} />
                    </div>
                    <div>
                      <label className={LABEL}>Driver Mobile</label>
                      <input type="tel" name="driverMobile" value={formData.driverMobile} readOnly className={READONLY} />
                    </div>
                    <div>
                      <label className={LABEL}>Driver License Number</label>
                      <input
                        type="text"
                        name="driverLicenseNumber"
                        value={formData.driverLicenseNumber}
                        readOnly
                        className={READONLY}
                      />
                    </div>
                    {/* Chosen on the Route step, where it drives the map. Shown
                        here read-only so this step still reads as the full
                        vehicle-and-driver picture. */}
                    <div>
                      <label className={LABEL}>Truck</label>
                      <input
                        type="text"
                        value={
                          formData.truckNumber
                            ? `${formData.truckNumber}${selectedTruck?.deviceName ? ` — ${selectedTruck.deviceName}` : ''}`
                            : ''
                        }
                        readOnly
                        className={READONLY}
                      />
                      <p className="text-xs text-slate-500 mt-1">Set on the Route step.</p>
                    </div>
                  </div>

                  {/* Say plainly when the trip will not be trackable, rather
                      than letting the user find out on the Trip Routes page. */}
                  {!isEditing && (!deviceId || !hasCoords) && (
                    <p className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>
                        {!hasCoords
                          ? 'From and To were not pinned on the map, so this trip will not appear on Trip Routes. Go back to the Route step and pick them from the map or search.'
                          : `${formData.truckNumber || 'This truck'} has no GPS tracker fitted, so the paperwork will be created but the trip will not appear on Trip Routes. Link a tracker to it under Fleet Management.`}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {/* ---------- Step 3: Parties ---------- */}
              {step === 2 && (
                <div className="space-y-6">
                  {/* Trip details sit with the parties rather than the map —
                      the route step is about picking points, and these are the
                      terms of the job those points belong to. */}
                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-1">Trip Details</h2>
                    <p className="text-sm text-slate-500 mb-4">
                      When this journey runs, and its status on the trips list.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className={LABEL}>Trip Date</label>
                        <input
                          type="date"
                          name="tripDate"
                          value={formData.tripDate}
                          onChange={handleInputChange}
                          className={INPUT}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>Loading Date</label>
                        <input
                          type="date"
                          name="loadingDate"
                          value={formData.loadingDate}
                          onChange={handleInputChange}
                          className={INPUT}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>Delivery Date</label>
                        <input
                          type="date"
                          name="deliveryDate"
                          value={formData.deliveryDate}
                          onChange={handleInputChange}
                          className={INPUT}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>Status</label>
                        <select
                          name="status"
                          value={formData.status}
                          onChange={handleInputChange}
                          className={INPUT}
                        >
                          <option>In Transit</option>
                          <option>Delivered</option>
                          <option>Completed</option>
                        </select>
                      </div>
                    </div>

                    {/* The route is set two steps back; showing it here means
                        the dates are read against the journey they describe. */}
                    {(origin || destination) && (
                      <p className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-green-600" />
                        <span className="font-medium text-slate-800">
                          {origin ? shortPlace(origin.name) : '—'}
                        </span>
                        <Navigation className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                        <Flag className="h-3.5 w-3.5 shrink-0 text-red-600" />
                        <span className="font-medium text-slate-800">
                          {destination ? shortPlace(destination.name) : '—'}
                        </span>
                        {routeInfo?.distanceKm ? (
                          <span className="text-slate-500">· {routeInfo.distanceKm} km</span>
                        ) : null}
                      </p>
                    )}
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Supplier (Consignor)</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={LABEL}>Supplier Name</label>
                        <input
                          type="text"
                          name="supplierName"
                          placeholder="e.g., ABC Enterprises"
                          value={formData.supplierName}
                          onChange={handleInputChange}
                          className={INPUT}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>GST Number</label>
                        <input
                          type="text"
                          name="supplierGst"
                          placeholder="e.g., 27AABCT1234G1Z0"
                          value={formData.supplierGst}
                          onChange={handleInputChange}
                          className={INPUT}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>Address</label>
                        <input
                          type="text"
                          name="supplierAddress"
                          placeholder="Enter address"
                          value={formData.supplierAddress}
                          onChange={handleInputChange}
                          className={INPUT}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>Contact Number</label>
                        <input
                          type="tel"
                          name="supplierContact"
                          placeholder="e.g., 9876543210"
                          value={formData.supplierContact}
                          onChange={handleInputChange}
                          className={INPUT}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Buyer (Consignee)</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={LABEL}>Buyer Name</label>
                        <input
                          type="text"
                          name="buyerName"
                          placeholder="e.g., XYZ Traders"
                          value={formData.buyerName}
                          onChange={handleInputChange}
                          className={INPUT}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>GST Number</label>
                        <input
                          type="text"
                          name="buyerGst"
                          placeholder="e.g., 27AABCT1234G1Z0"
                          value={formData.buyerGst}
                          onChange={handleInputChange}
                          className={INPUT}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>Address</label>
                        <input
                          type="text"
                          name="buyerAddress"
                          placeholder="Enter address"
                          value={formData.buyerAddress}
                          onChange={handleInputChange}
                          className={INPUT}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>Contact Number</label>
                        <input
                          type="tel"
                          name="buyerContact"
                          placeholder="e.g., 9876543210"
                          value={formData.buyerContact}
                          onChange={handleInputChange}
                          className={INPUT}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ---------- Step 4: Goods & Freight ---------- */}
              {step === 3 && (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">Goods Details</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className={LABEL}>Goods Description</label>
                      <input
                        type="text"
                        name="goodsDescription"
                        placeholder="e.g., Electronics, Clothing, Food items"
                        value={formData.goodsDescription}
                        onChange={handleInputChange}
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Quantity</label>
                      <input
                        type="number"
                        name="quantity"
                        placeholder="0"
                        value={formData.quantity}
                        onChange={handleInputChange}
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Unit</label>
                      <select name="unit" value={formData.unit} onChange={handleInputChange} className={INPUT}>
                        <option>Kg</option>
                        <option>Ton</option>
                        <option>Boxes</option>
                        <option>Bags</option>
                      </select>
                    </div>
                    <div>
                      <label className={LABEL}>Total Weight</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          name="totalWeight"
                          placeholder="0"
                          value={formData.totalWeight}
                          onChange={handleInputChange}
                          className="flex-1 min-w-0 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                          name="weightUnit"
                          value={formData.weightUnit}
                          onChange={handleInputChange}
                          aria-label="Weight unit"
                          className="w-24 px-2 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option>Kg</option>
                          <option>Ton</option>
                          <option>Quintal</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className={LABEL}>Declared Value (₹)</label>
                      <input
                        type="number"
                        name="declaredValue"
                        placeholder="0"
                        value={formData.declaredValue}
                        onChange={handleInputChange}
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Freight Rate (₹ per {formData.unit})</label>
                      <input
                        type="number"
                        name="freightRate"
                        placeholder="0"
                        value={formData.freightRate}
                        onChange={handleInputChange}
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Total Freight Amount (₹)</label>
                      <input
                        type="number"
                        name="totalFreightAmount"
                        value={formData.totalFreightAmount}
                        readOnly
                        className={READONLY}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={handleCalculateFreight}
                        className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
                      >
                        Calculate Total Freight
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ---------- Step 5: Documents & Payment ---------- */}
              {step === 4 && (
                <div className="space-y-6">
                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-1">Document References</h2>
                    <p className="text-sm text-slate-500 mb-4">
                      Printed on the Lorry Receipt, Tax Invoice and Goods Declaration.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className={LABEL}>LR Number</label>
                        <input
                          type="text"
                          name="lrNumber"
                          placeholder="e.g., 80101"
                          value={formData.lrNumber}
                          onChange={handleInputChange}
                          className={INPUT}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>Bill Number</label>
                        <input
                          type="text"
                          name="billNumber"
                          placeholder="e.g., BILL-2201"
                          value={formData.billNumber}
                          onChange={handleInputChange}
                          className={INPUT}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>Invoice Number</label>
                        <input
                          type="text"
                          name="invoiceNo"
                          placeholder="e.g., INV-2201"
                          value={formData.invoiceNo}
                          onChange={handleInputChange}
                          className={INPUT}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>GST Payable By</label>
                        <select
                          name="gstPayableBy"
                          value={formData.gstPayableBy}
                          onChange={handleInputChange}
                          className={INPUT}
                        >
                          <option>Consignor</option>
                          <option>Consignee</option>
                          <option>Transporter</option>
                        </select>
                      </div>
                      <div>
                        <label className={LABEL}>L.R. Charges (₹)</label>
                        <input
                          type="number"
                          name="lrCharges"
                          placeholder="0"
                          value={formData.lrCharges}
                          onChange={handleInputChange}
                          className={INPUT}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>GST Rate (%)</label>
                        <input
                          type="number"
                          name="gstRate"
                          placeholder="e.g., 5"
                          min="0"
                          max="100"
                          step="0.01"
                          value={formData.gstRate}
                          onChange={handleInputChange}
                          className={INPUT}
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Applied to freight + LR charges on the invoice.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-1">Invoice References</h2>
                    <p className="text-sm text-slate-500 mb-4">
                      Optional. These fill the reference boxes across the top of the Tax Invoice.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[
                        { name: 'deliveryNote', label: 'Delivery Note', placeholder: 'e.g., DN-77' },
                        { name: 'paymentTerms', label: 'Mode / Terms of Payment', placeholder: 'e.g., 30 Days Credit' },
                        { name: 'supplierRef', label: "Supplier's Ref.", placeholder: 'e.g., SR-12' },
                        { name: 'otherRef', label: 'Other Reference(s)', placeholder: 'Optional' },
                        { name: 'buyerOrderNo', label: "Buyer's Order No.", placeholder: 'e.g., PO-9081' },
                        { name: 'buyerOrderDate', label: "Buyer's Order Date", placeholder: 'e.g., 01-Aug-26' },
                        { name: 'despatchDocNo', label: 'Despatch Document No.', placeholder: 'e.g., DD-455' },
                        { name: 'deliveryNoteDate', label: 'Delivery Note Date', placeholder: 'e.g., 02-Aug-26' },
                        { name: 'destination', label: 'Destination', placeholder: 'Defaults to the route "To"' },
                      ].map((field) => (
                        <div key={field.name}>
                          <label className={LABEL}>{field.label}</label>
                          <input
                            type="text"
                            name={field.name}
                            placeholder={field.placeholder}
                            value={formData[field.name]}
                            onChange={handleInputChange}
                            className={INPUT}
                          />
                        </div>
                      ))}
                      <div className="md:col-span-2 lg:col-span-3">
                        <label className={LABEL}>Terms of Delivery</label>
                        <input
                          type="text"
                          name="termsOfDelivery"
                          placeholder="e.g., Door delivery at consignee premises"
                          value={formData.termsOfDelivery}
                          onChange={handleInputChange}
                          className={INPUT}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Payment Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={LABEL}>Payment Method</label>
                        <select
                          name="paymentMethod"
                          value={formData.paymentMethod}
                          onChange={handleInputChange}
                          className={INPUT}
                        >
                          <option>Bank Transfer</option>
                          <option>Cash</option>
                          <option>Cheque</option>
                          <option>UPI/Mobile Wallet</option>
                        </select>
                      </div>
                      <div>
                        <label className={LABEL}>Payment Status</label>
                        <select
                          name="paymentStatus"
                          value={formData.paymentStatus}
                          onChange={handleInputChange}
                          className={INPUT}
                        >
                          <option>Pending</option>
                          <option>Partial</option>
                          <option>Completed</option>
                        </select>
                      </div>
                      <div>
                        <label className={LABEL}>Advance Amount (₹)</label>
                        <input
                          type="number"
                          name="advanceAmount"
                          placeholder="0"
                          value={formData.advanceAmount}
                          onChange={handleInputChange}
                          className={INPUT}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>Balance Amount (₹)</label>
                        <input
                          type="number"
                          name="balanceAmount"
                          value={formData.balanceAmount}
                          readOnly
                          className={READONLY}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className={LABEL}>Payment Notes</label>
                        <textarea
                          name="paymentNotes"
                          placeholder="e.g., Payment terms, banking details, reference numbers..."
                          value={formData.paymentNotes}
                          onChange={handleInputChange}
                          rows="3"
                          className={INPUT}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <button
                          type="button"
                          onClick={handleCalculateBalance}
                          className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
                        >
                          Calculate Balance Amount
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* A last read of the trip before it is saved. */}
                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Review</h2>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <dt className="text-slate-500">Route</dt>
                        <dd className="mt-0.5 font-medium text-slate-900">
                          {origin ? shortPlace(origin.name) : '—'} → {destination ? shortPlace(destination.name) : '—'}
                          {routeInfo?.distanceKm ? (
                            <span className="ml-1 font-normal text-slate-500">
                              ({routeInfo.distanceKm} km)
                            </span>
                          ) : null}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Vehicle &amp; Driver</dt>
                        <dd className="mt-0.5 font-medium text-slate-900">
                          {formData.truckNumber || '—'}
                          {formData.driverName ? ` · ${formData.driverName}` : ''}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Party</dt>
                        <dd className="mt-0.5 font-medium text-slate-900">{formData.buyerName || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Freight</dt>
                        <dd className="mt-0.5 font-medium text-slate-900">
                          {formData.totalFreightAmount ? `₹${formData.totalFreightAmount}` : '—'}
                        </dd>
                      </div>
                    </dl>

                    {!isEditing && (
                      <p className="mt-4 text-xs text-slate-500">
                        {hasCoords && deviceId
                          ? 'This trip will also appear on Trip Routes for live tracking.'
                          : 'This trip will be created as paperwork only — it will not appear on Trip Routes.'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {stepError && (
                <div className="flex gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{stepError}</span>
                </div>
              )}

              {saveError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {saveError}
                </div>
              )}

              {/* Wizard navigation. Back on the first step leaves the form
                  entirely, so there is always one obvious way out. */}
              <div className="flex items-center justify-between gap-4 pb-2">
                <button
                  type="button"
                  onClick={step === 0 ? () => navigate('/trips-and-documents') : goBack}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {step === 0 ? 'Cancel' : 'Back'}
                </button>

                <div className="flex items-center gap-3">
                  {/* An edit is rarely a walk through all five steps — offer a
                      direct save from any step once the record already exists. */}
                  {isEditing && !isLastStep && (
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-medium disabled:opacity-60"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  )}

                  {isLastStep ? (
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-60"
                    >
                      {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                      {saving
                        ? (isEditing ? 'Saving...' : 'Creating...')
                        : (isEditing ? 'Save Changes' : 'Create Trip')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={goNext}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Next
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
