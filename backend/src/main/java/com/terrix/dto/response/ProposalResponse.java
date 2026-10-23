package com.terrix.dto.response;

import com.terrix.domain.enums.LandStatus;
import com.terrix.domain.enums.ProposalStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ProposalResponse(
        UUID id,
        UUID landLotId,
        String landLotTitle,
        UUID buyerId,
        String buyerName,
        String buyerEmail,
        BigDecimal offeredPrice,
        String message,
        ProposalStatus status,
        OffsetDateTime createdAt,
        LandStatus landLotStatus,
        BigDecimal landLotPrice
) {}
