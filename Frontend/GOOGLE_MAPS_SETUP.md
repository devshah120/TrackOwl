# Google Maps Setup Guide

## Get Your Google Maps API Key

### Step 1: Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click on the project dropdown at the top
3. Click "NEW PROJECT"
4. Enter project name: "TrackOwl Fleet"
5. Click "CREATE"

### Step 2: Enable Google Maps API
1. In the Cloud Console, go to **APIs & Services > Library**
2. Search for "Maps JavaScript API"
3. Click on it and press **ENABLE**
4. Also enable:
   - **Maps Static API**
   - **Directions API** (for route visualization)

### Step 3: Create API Key
1. Go to **APIs & Services > Credentials**
2. Click **+ CREATE CREDENTIALS** > **API Key**
3. Copy your API Key
4. (Optional) Restrict the key to only JavaScript origins:
   - Click on your key to edit it
   - Under "Application restrictions", select "HTTP referrers (web sites)"
   - Add: `http://localhost:5173`, `http://localhost:5174`
   - Under "API restrictions", select "Maps JavaScript API"

### Step 4: Add to Environment File
1. Open `Frontend/.env.local`
2. Replace `YOUR_GOOGLE_MAPS_API_KEY_HERE` with your actual API key:
   ```
   REACT_APP_GOOGLE_MAPS_API_KEY=AIzaSyD...YOUR_KEY_HERE
   ```

### Step 5: Restart Frontend
```bash
cd Frontend
npm run dev
```

## Features Enabled

✅ **Real-time Map Display** - Shows all trucks on an interactive map
✅ **Live Location Tracking** - Trucks update their positions in real-time
✅ **Info Windows** - Click on a truck marker to see details
✅ **Multiple Truck Statuses** - Different colored markers for different statuses
✅ **Fleet Summary** - List of all trucks on the right sidebar
✅ **Responsive Design** - Works on mobile, tablet, and desktop

## Truck Statuses on Map

- 🔵 **Moving** (Blue) - Actively in transit
- 🟡 **Idle** (Yellow) - Parked and waiting
- 🔴 **Stopped** (Red) - Stopped at a location
- ⚫ **Offline** (Gray) - Lost connection

## Map Features

- **Zoom In/Out** - Use map controls or mouse scroll
- **Pan** - Click and drag to move around
- **Select Truck** - Click a marker or item in the fleet summary
- **View Details** - Selected truck info appears in the right panel
- **Real-time Updates** - Map updates every 2 seconds with new positions

## Troubleshooting

### Map not loading?
1. Check if `REACT_APP_GOOGLE_MAPS_API_KEY` is set in `.env.local`
2. Verify the API key is valid
3. Check browser console for error messages
4. Ensure Maps JavaScript API is enabled in Cloud Console

### Markers not showing?
1. Make sure coordinates are within valid ranges
2. Check if trucks have proper lat/lng values
3. Verify API key has correct permissions

### Getting 403 error?
1. Check if Maps JavaScript API is enabled
2. Verify API restrictions are set correctly
3. Check referrer restrictions if applied

## Production Deployment

For production, use an environment variable service:
1. Set `REACT_APP_GOOGLE_MAPS_API_KEY` in your hosting platform's environment variables
2. Restrict API key to your production domain
3. Consider using API quotas to prevent unexpected charges

## Pricing

Google Maps API is free up to a certain quota:
- First $200/month credit applies
- After that, pay per request
- Check [Google Maps Pricing](https://cloud.google.com/maps-platform/pricing) for details

## Next Steps

1. ✅ Get API key and add to `.env.local`
2. Restart frontend server
3. Test the Fleet Live Map feature
4. Implement real route visualization
5. Add geofencing alerts
6. Integrate with real GPS data from devices
