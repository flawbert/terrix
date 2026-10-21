import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import CircleGeom from 'ol/geom/Circle';
import Draw from 'ol/interaction/Draw';
import Snap from 'ol/interaction/Snap';
import { fromLonLat, toLonLat } from 'ol/proj';
import { getArea, getDistance } from 'ol/sphere';
import { Fill, Stroke, Style, Text } from 'ol/style';
import { GeoJsonPolygon, LandLot } from '../types/land';
import { formatArea, formatCurrency, formatDistance } from '../utils/formatters';

export type MapInteractionMode = 'VIEW' | 'DRAW_POLYGON' | 'DRAW_CIRCLE';

interface LandMapProps {
  lands: LandLot[];
  mode: MapInteractionMode;
  satelliteMode: boolean;
  selectedLand: LandLot | null;
  onSelectLand: (land: LandLot | null) => void;
  onPolygonDrawn: (geometry: GeoJsonPolygon, estimatedAreaSqm: number) => void;
  onCircleDrawn: (centerLon: number, centerLat: number, radiusMeters: number) => void;
}

export const LandMap: React.FC<LandMapProps> = ({
  lands,
  mode,
  satelliteMode,
  selectedLand,
  onSelectLand,
  onPolygonDrawn,
  onCircleDrawn,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const landsSourceRef = useRef<VectorSource>(new VectorSource());
  const drawSourceRef = useRef<VectorSource>(new VectorSource());
  const osmLayerRef = useRef<TileLayer<OSM> | null>(null);
  const satelliteLayerRef = useRef<TileLayer<XYZ> | null>(null);

  const [liveMetricTooltip, setLiveMetricTooltip] = useState<string | null>(null);

  // Initialize OpenLayers Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const osmLayer = new TileLayer({
      source: new OSM(),
      visible: !satelliteMode,
    });

    const satelliteLayer = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attributions: 'Tiles © Esri',
      }),
      visible: satelliteMode,
    });

    osmLayerRef.current = osmLayer;
    satelliteLayerRef.current = satelliteLayer;

    const landsLayer = new VectorLayer({
      source: landsSourceRef.current,
      style: (feature) => {
        const lot: LandLot | undefined = feature.get('landData');
        const isSelected = selectedLand && lot && selectedLand.id === lot.id;

        let fillColor = 'rgba(16, 185, 129, 0.35)'; // AVAILABLE (Emerald)
        let strokeColor = '#10b981';

        if (lot?.status === 'RESERVED') {
          fillColor = 'rgba(245, 158, 11, 0.40)'; // RESERVED (Amber)
          strokeColor = '#f59e0b';
        } else if (lot?.status === 'SOLD') {
          fillColor = 'rgba(239, 68, 68, 0.40)'; // SOLD (Red)
          strokeColor = '#ef4444';
        }

        if (isSelected) {
          strokeColor = '#38bdf8';
          fillColor = 'rgba(56, 189, 248, 0.45)';
        }

        return new Style({
          fill: new Fill({ color: fillColor }),
          stroke: new Stroke({
            color: strokeColor,
            width: isSelected ? 3.5 : 2.2,
          }),
          text: new Text({
            text: lot ? `${lot.title}\n${formatCurrency(lot.price)}` : '',
            font: '600 12px Inter, system-ui, sans-serif',
            fill: new Fill({ color: '#ffffff' }),
            stroke: new Stroke({ color: '#0f172a', width: 3.5 }),
            overflow: true,
          }),
        });
      },
    });

    const interactionLayer = new VectorLayer({
      source: drawSourceRef.current,
      style: new Style({
        fill: new Fill({ color: 'rgba(56, 189, 248, 0.22)' }),
        stroke: new Stroke({
          color: '#38bdf8',
          width: 2.5,
          lineDash: [6, 6],
        }),
      }),
    });

    const map = new Map({
      target: mapContainerRef.current,
      layers: [osmLayer, satelliteLayer, landsLayer, interactionLayer],
      view: new View({
        center: fromLonLat([-47.0621, -22.9051]),
        zoom: 15,
      }),
    });

    mapInstanceRef.current = map;

    return () => {
      map.setTarget(undefined);
      mapInstanceRef.current = null;
    };
  }, []);

  // Toggle Satellite vs Street Layer
  useEffect(() => {
    if (osmLayerRef.current && satelliteLayerRef.current) {
      osmLayerRef.current.setVisible(!satelliteMode);
      satelliteLayerRef.current.setVisible(satelliteMode);
    }
  }, [satelliteMode]);

  // Render Land Polygons on the Map
  useEffect(() => {
    const source = landsSourceRef.current;
    source.clear();

    lands.forEach((land) => {
      if (!land.geometry?.coordinates?.length) return;
      const projectedRing = land.geometry.coordinates[0].map((coord) =>
        fromLonLat([coord[0], coord[1]])
      );
      const polygon = new Polygon([projectedRing]);
      const feature = new Feature({ geometry: polygon });
      feature.set('landData', land);
      source.addFeature(feature);
    });
  }, [lands, selectedLand]);

  // Handle Map Click for Viewing Land Lot Popup
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (event: any) => {
      if (mode !== 'VIEW') return;
      let clickedLot: LandLot | null = null;
      map.forEachFeatureAtPixel(event.pixel, (feature) => {
        const data = feature.get('landData') as LandLot | undefined;
        if (data) {
          clickedLot = data;
          return true;
        }
        return false;
      });
      onSelectLand(clickedLot);
    };

    map.on('singleclick', handleMapClick);
    return () => {
      map.un('singleclick', handleMapClick);
    };
  }, [mode, onSelectLand]);

  // Handle Drawing Interactions (Polygon Registration & Circle Radius Search)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    setLiveMetricTooltip(null);
    if (mode === 'VIEW') {
      return;
    }

    drawSourceRef.current.clear();

    if (mode === 'DRAW_POLYGON') {
      const drawPolygon = new Draw({
        source: drawSourceRef.current,
        type: 'Polygon',
      });
      const snap = new Snap({ source: landsSourceRef.current });

      drawPolygon.on('drawstart', (evt) => {
        const geom = evt.feature.getGeometry() as Polygon;
        geom.on('change', () => {
          const area = getArea(geom, { projection: 'EPSG:3857' });
          setLiveMetricTooltip(`Live Polygon Area: ${formatArea(area)}`);
        });
      });

      drawPolygon.on('drawend', (evt) => {
        const geom = evt.feature.getGeometry() as Polygon;
        const area = getArea(geom, { projection: 'EPSG:3857' });
        const rawRing = geom.getCoordinates()[0];
        const lonLatRing = rawRing.map((coord) => {
          const [lon, lat] = toLonLat(coord);
          return [Number(lon.toFixed(6)), Number(lat.toFixed(6))];
        });

        setLiveMetricTooltip(null);
        onPolygonDrawn(
          {
            type: 'Polygon',
            coordinates: [lonLatRing],
          },
          Math.round(area)
        );
      });

      map.addInteraction(drawPolygon);
      map.addInteraction(snap);

      return () => {
        map.removeInteraction(drawPolygon);
        map.removeInteraction(snap);
      };
    }

    if (mode === 'DRAW_CIRCLE') {
      const drawCircle = new Draw({
        source: drawSourceRef.current,
        type: 'Circle',
      });

      drawCircle.on('drawstart', (evt) => {
        drawSourceRef.current.clear();
        const circleGeom = evt.feature.getGeometry() as CircleGeom;
        circleGeom.on('change', () => {
          const centerLonLat = toLonLat(circleGeom.getCenter());
          const edgeCoord = [
            circleGeom.getCenter()[0] + circleGeom.getRadius(),
            circleGeom.getCenter()[1],
          ];
          const edgeLonLat = toLonLat(edgeCoord);
          const geodesicRadius = getDistance(centerLonLat, edgeLonLat);
          setLiveMetricTooltip(`Search Radius: ${formatDistance(geodesicRadius)}`);
        });
      });

      drawCircle.on('drawend', (evt) => {
        const circleGeom = evt.feature.getGeometry() as CircleGeom;
        const centerLonLat = toLonLat(circleGeom.getCenter());
        const edgeCoord = [
          circleGeom.getCenter()[0] + circleGeom.getRadius(),
          circleGeom.getCenter()[1],
        ];
        const edgeLonLat = toLonLat(edgeCoord);
        const geodesicRadius = Math.max(10, Math.round(getDistance(centerLonLat, edgeLonLat)));

        setLiveMetricTooltip(`Active Filter Radius: ${formatDistance(geodesicRadius)}`);
        onCircleDrawn(
          Number(centerLonLat[0].toFixed(6)),
          Number(centerLonLat[1].toFixed(6)),
          geodesicRadius
        );
      });

      map.addInteraction(drawCircle);

      return () => {
        map.removeInteraction(drawCircle);
      };
    }
  }, [mode, onPolygonDrawn, onCircleDrawn]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainerRef}
        data-testid="openlayers-map-canvas"
        className="w-full h-full"
      />

      {/* Dynamic Live Metric Tooltip (geojson.io style) */}
      {liveMetricTooltip && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-slate-900/95 border border-sky-500/60 text-sky-300 px-4 py-2 rounded-full shadow-xl text-sm font-semibold tracking-wide flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
          {liveMetricTooltip}
        </div>
      )}
    </div>
  );
};
