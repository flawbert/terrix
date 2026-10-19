package com.terrix.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record CreateProposalRequest(
        @NotNull(message = "Offered price is required")
        @Positive(message = "Offered price must be greater than zero")
        BigDecimal offeredPrice,

        String message
) {}
