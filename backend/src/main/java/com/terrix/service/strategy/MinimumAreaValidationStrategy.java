package com.terrix.service.strategy;

import com.terrix.domain.repository.LandLotRepository;
import com.terrix.exception.InvalidGeometryException;
import org.locationtech.jts.geom.Polygon;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(2)
public class MinimumAreaValidationStrategy implements LandValidationStrategy {

    private static final double MIN_AREA_SQ_METERS = 25.0;
    private static final double MAX_AREA_SQ_METERS = 50_000_000.0; // 5,000 hectares (50 km²)

    private final LandLotRepository landLotRepository;

    public MinimumAreaValidationStrategy(LandLotRepository landLotRepository) {
        this.landLotRepository = landLotRepository;
    }

    @Override
    public void validate(Polygon candidatePolygon) {
        Double areaSqMeters = landLotRepository.calculateGeodesicAreaSqMeters(candidatePolygon);
        if (areaSqMeters == null || areaSqMeters < MIN_AREA_SQ_METERS) {
            throw new InvalidGeometryException(
                    String.format("The drawn polygon area is too small (minimum required is %.0f m²).", MIN_AREA_SQ_METERS)
            );
        }
        if (areaSqMeters > MAX_AREA_SQ_METERS) {
            throw new InvalidGeometryException(
                    "The drawn polygon exceeds the maximum allowed land lot area of 5,000 hectares (50 km²)."
            );
        }
    }
}
