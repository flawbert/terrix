package com.terrix.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record GeoJsonPolygonDto(
        @NotNull(message = "Geometry type is required")
        String type,

        @NotEmpty(message = "Polygon coordinates are required")
        List<List<List<Double>>> coordinates
) {}
