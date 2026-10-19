package com.terrix.service.strategy;

import com.terrix.domain.repository.LandLotRepository;
import com.terrix.exception.LandOverlapException;
import org.locationtech.jts.geom.Polygon;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(1)
public class PolygonOverlapValidationStrategy implements LandValidationStrategy {

    private final LandLotRepository landLotRepository;

    public PolygonOverlapValidationStrategy(LandLotRepository landLotRepository) {
        this.landLotRepository = landLotRepository;
    }

    @Override
    public void validate(Polygon candidatePolygon) {
        boolean overlaps = landLotRepository.existsOverlappingLand(candidatePolygon);
        if (overlaps) {
            throw new LandOverlapException(
                    "Registration blocked: the drawn land polygon overlaps an already registered land lot."
            );
        }
    }
}
