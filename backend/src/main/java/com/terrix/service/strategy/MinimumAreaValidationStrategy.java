package com.terrix.service.strategy;

import com.terrix.domain.repository.LandLotRepository;
import com.terrix.exception.InvalidGeometryException;
import org.locationtech.jts.geom.Polygon;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(2)
public class MinimumAreaValidationStrategy implements LandValidationStrategy {

    private static final double MIN_AREA_SQ_METERS = 10.0;
    private final LandLotRepository landLotRepository;

    public MinimumAreaValidationStrategy(LandLotRepository landLotRepository) {
        this.landLotRepository = landLotRepository;
    }

    @Override
    public void validate(Polygon candidatePolygon) {
        Double area = landLotRepository.calculateGeodesicAreaSqMeters(candidatePolygon);
        if (area == null || area < MIN_AREA_SQ_METERS) {
            throw new InvalidGeometryException(
                    "The drawn land lot is too small. Minimum required area is " + MIN_AREA_SQ_METERS + " square meters."
            );
        }
    }
}
