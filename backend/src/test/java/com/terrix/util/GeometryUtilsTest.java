package com.terrix.util;

import com.terrix.exception.InvalidGeometryException;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Polygon;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class GeometryUtilsTest {

    @Test
    void shouldConvertValidCoordinatesToPolygonAndBack() {
        List<List<List<Double>>> coords = List.of(List.of(
                List.of(-47.0626, -22.9056),
                List.of(-47.0616, -22.9056),
                List.of(-47.0616, -22.9046),
                List.of(-47.0626, -22.9046),
                List.of(-47.0626, -22.9056)
        ));

        Polygon polygon = GeometryUtils.toPolygon(coords);
        assertNotNull(polygon);
        assertEquals(4326, polygon.getSRID());
        assertTrue(polygon.isValid());

        List<List<List<Double>>> exported = GeometryUtils.fromPolygon(polygon);
        assertEquals(1, exported.size());
        assertEquals(5, exported.getFirst().size());
    }

    @Test
    void shouldAutoCloseUnclosedPolygonRing() {
        List<List<List<Double>>> unclosedCoords = List.of(List.of(
                List.of(-47.0626, -22.9056),
                List.of(-47.0616, -22.9056),
                List.of(-47.0616, -22.9046),
                List.of(-47.0626, -22.9046)
        ));

        Polygon polygon = GeometryUtils.toPolygon(unclosedCoords);
        assertNotNull(polygon);
        assertTrue(polygon.getExteriorRing().isClosed());
    }

    @Test
    void shouldThrowExceptionWhenCoordinatesAreNullOrTooShort() {
        assertThrows(InvalidGeometryException.class, () -> GeometryUtils.toPolygon(null));
        assertThrows(InvalidGeometryException.class, () -> GeometryUtils.toPolygon(List.of()));
        assertThrows(InvalidGeometryException.class, () -> GeometryUtils.toPolygon(List.of(List.of(
                List.of(-47.0, -22.0),
                List.of(-47.1, -22.1)
        ))));
    }

    @Test
    void shouldThrowExceptionWhenPointIsInvalidOrOutOfBounds() {
        List<List<List<Double>>> invalidPoint = List.of(List.of(
                List.of(-47.0),
                List.of(-47.1, -22.0),
                List.of(-47.1, -22.1),
                List.of(-47.0, -22.0)
        ));
        assertThrows(InvalidGeometryException.class, () -> GeometryUtils.toPolygon(invalidPoint));

        List<List<List<Double>>> outOfBounds = List.of(List.of(
                List.of(-195.0, -22.0),
                List.of(-47.1, -22.0),
                List.of(-47.1, -22.1),
                List.of(-195.0, -22.0)
        ));
        assertThrows(InvalidGeometryException.class, () -> GeometryUtils.toPolygon(outOfBounds));
    }

    @Test
    void shouldThrowExceptionForSelfIntersectingPolygon() {
        List<List<List<Double>>> bowtie = List.of(List.of(
                List.of(0.0, 0.0),
                List.of(2.0, 2.0),
                List.of(0.0, 2.0),
                List.of(2.0, 0.0),
                List.of(0.0, 0.0)
        ));
        assertThrows(InvalidGeometryException.class, () -> GeometryUtils.toPolygon(bowtie));
    }

    @Test
    void shouldReturnEmptyListWhenPolygonIsNull() {
        assertTrue(GeometryUtils.fromPolygon(null).isEmpty());
    }
}
