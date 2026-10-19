package com.terrix.service.strategy;

import org.locationtech.jts.geom.Polygon;

/**
 * Strategy Design Pattern interface for validating land lot geometries and business rules.
 * Follows the Open/Closed Principle (SOLID): new spatial or environmental rules can be added
 * without modifying the core service logic.
 */
public interface LandValidationStrategy {
    void validate(Polygon candidatePolygon);
}
