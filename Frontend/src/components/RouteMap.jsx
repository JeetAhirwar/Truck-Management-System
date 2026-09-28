import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { Place as PlaceIcon } from '@mui/icons-material';
import 'leaflet/dist/leaflet.css';

/** GeoJSON LineString `[[lng, lat], ...]` -> Leaflet `[[lat, lng], ...]` */
export const geoJsonToLatLngs = (geometry) => {
  const coords = Array.isArray(geometry) ? geometry : geometry?.coordinates;
  if (!Array.isArray(coords)) return [];
  return coords
    .filter((c) => Array.isArray(c) && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1])))
    .map(([lng, lat]) => [Number(lat), Number(lng)]);
};

const pinIcon = (color, text) =>
  L.divIcon({
    className: '',
    html:
      `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);` +
      `background:${color};border:2px solid #fff;box-shadow:0 6px 14px rgba(0,0,0,.4);` +
      `display:flex;align-items:center;justify-content:center">` +
      `<span style="transform:rotate(45deg);color:#fff;font:800 12px/1 Inter,sans-serif">${text}</span>` +
      `</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds || !bounds.length) return;
    if (bounds.length === 1) map.setView(bounds[0], 12, { animate: true });
    else map.fitBounds(L.latLngBounds(bounds), { padding: [48, 48], maxZoom: 14, animate: true });
  }, [map, bounds]);
  return null;
}

/**
 * Interactive OpenStreetMap route map.
 * `routeCoords` is an array of [lat, lng] pairs; while a route is still being
 * fetched a dashed straight line connects the two markers instead.
 */
export default function RouteMap({
  origin,
  destination,
  routeCoords = [],
  height = 300,
  loading = false,
  emptyHint = true,
  zoomControl = true
}) {
  const bounds = useMemo(() => {
    if (origin && destination) return [[origin.lat, origin.lng], [destination.lat, destination.lng]];
    if (origin) return [[origin.lat, origin.lng]];
    if (destination) return [[destination.lat, destination.lng]];
    return null;
  }, [origin, destination]);

  const hasRoute = routeCoords.length > 1;
  const connector =
    !hasRoute && origin && destination
      ? [[origin.lat, origin.lng], [destination.lat, destination.lng]]
      : [];
  const showEmpty = emptyHint && !origin && !destination && !loading;

  return (
    <Box
      sx={{
        position: 'relative',
        height,
        borderRadius: 3,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider'
      }}
    >
      <MapContainer
        center={[22.9734, 78.6569]}
        zoom={5}
        scrollWheelZoom={false}
        zoomControl={zoomControl}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {origin && <Marker position={[origin.lat, origin.lng]} icon={pinIcon('#2563eb', 'A')} />}
        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={pinIcon('#dc2626', 'B')} />
        )}
        {connector.length === 2 && (
          <Polyline
            positions={connector}
            pathOptions={{ color: '#64748b', weight: 3, opacity: 0.7, dashArray: '8 8' }}
          />
        )}
        {hasRoute && (
          <Polyline positions={routeCoords} pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.9 }} />
        )}
        <FitBounds bounds={bounds} />
      </MapContainer>

      {loading && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 1200,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'rgba(2,6,23,0.45)',
            backdropFilter: 'blur(2px)'
          }}
        >
          <Stack  spacing={1.5} sx={{ alignItems: 'center' }}>
            <CircularProgress size={34} sx={{ color: '#fff' }} />
            <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600 }}>
              Calculating route &amp; tolls…
            </Typography>
          </Stack>
        </Box>
      )}

      {showEmpty && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 1100,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
            textAlign: 'center',
            px: 3
          }}
        >
          <Box>
            <PlaceIcon sx={{ fontSize: 34, color: 'text.disabled', mb: 0.5 }} />
            <Typography variant="body2" fontWeight={700}>
              Search an origin and destination
            </Typography>
            <Typography variant="caption" color="text.secondary">
              The route is drawn here automatically.
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}
