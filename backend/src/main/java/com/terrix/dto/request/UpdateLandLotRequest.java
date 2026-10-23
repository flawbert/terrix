package com.terrix.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * Payload used by the owner of a land lot to edit the descriptive data of an existing listing.
 * The polygon geometry (and therefore the PostGIS-verified area) is immutable after registration.
 */
public record UpdateLandLotRequest(
        @NotBlank(message = "Title is required")
        @Size(max = 150)
        String title,

        @NotBlank(message = "Description is required")
        String description,

        @NotNull(message = "Price is required")
        @Positive(message = "Price must be greater than zero")
        BigDecimal price,

        @NotBlank(message = "Contact info is required")
        @Size(max = 150)
        String contactInfo
) {}
