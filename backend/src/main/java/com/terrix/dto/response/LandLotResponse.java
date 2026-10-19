package com.terrix.dto.response;

import com.terrix.domain.enums.LandStatus;
import com.terrix.dto.request.GeoJsonPolygonDto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record LandLotResponse(
        UUID id,
        String title,
        String description,
        BigDecimal price,
        Double areaSqMeters,
        BigDecimal pricePerSqMeter,
        String contactInfo,
        LandStatus status,
        GeoJsonPolygonDto geometry,
        UUID ownerId,
        String ownerName,
        OffsetDateTime createdAt
) {}
