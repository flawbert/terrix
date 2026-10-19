package com.terrix.util;

import com.terrix.exception.InvalidGeometryException;
import org.locationtech.jts.geom.*;

import java.util.ArrayList;
import java.util.List;

public final class GeometryUtils {

    public static final int SRID_WGS84 = 4326;
    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), SRID_WGS84);

    private GeometryUtils() {
    }

    public static Polygon toPolygon(List<List<List<Double>>> coordinates) {
        if (coordinates == null || coordinates.isEmpty() || coordinates.getFirst().size() < 4) {
            throw new InvalidGeometryException("A polygon must contain at least 3 distinct vertices (4 coordinates including closure).");
        }

        List<List<Double>> exteriorRingCoords = coordinates.getFirst();
        Coordinate[] jtsCoords = new Coordinate[exteriorRingCoords.size()];

        for (int i = 0; i < exteriorRingCoords.size(); i++) {
            List<Double> point = exteriorRingCoords.get(i);
            if (point == null || point.size() < 2) {
                throw new InvalidGeometryException("Each coordinate must contain [longitude, latitude].");
            }
            double lon = point.get(0);
            double lat = point.get(1);
            if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
                throw new InvalidGeometryException("Coordinates out of WGS84 bounds: longitude [-180, 180], latitude [-90, 90].");
            }
            jtsCoords[i] = new Coordinate(lon, lat);
        }

        if (!jtsCoords[0].equals2D(jtsCoords[jtsCoords.length - 1])) {
            Coordinate[] closedCoords = new Coordinate[jtsCoords.length + 1];
            System.arraycopy(jtsCoords, 0, closedCoords, 0, jtsCoords.length);
            closedCoords[jtsCoords.length] = new Coordinate(jtsCoords[0].x, jtsCoords[0].y);
            jtsCoords = closedCoords;
        }

        try {
            LinearRing shell = GEOMETRY_FACTORY.createLinearRing(jtsCoords);
            Polygon polygon = GEOMETRY_FACTORY.createPolygon(shell);
            polygon.setSRID(SRID_WGS84);

            if (!polygon.isValid() || polygon.isEmpty() || polygon.getArea() <= 0) {
                throw new InvalidGeometryException("The drawn polygon is self-intersecting or geometrically invalid.");
            }
            return polygon;
        } catch (IllegalArgumentException ex) {
            throw new InvalidGeometryException("Invalid polygon coordinates: " + ex.getMessage());
        }
    }

    public static List<List<List<Double>>> fromPolygon(Polygon polygon) {
        if (polygon == null || polygon.isEmpty()) {
            return List.of();
        }
        Coordinate[] coordinates = polygon.getExteriorRing().getCoordinates();
        List<List<Double>> ring = new ArrayList<>(coordinates.length);
        for (Coordinate coord : coordinates) {
            ring.add(List.of(coord.x, coord.y));
        }
        return List.of(ring);
    }
}
