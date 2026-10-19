package com.terrix.domain.entity;

import com.terrix.domain.enums.ProposalStatus;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "proposals")
public class Proposal {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "land_lot_id", nullable = false)
    private LandLot landLot;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "buyer_id", nullable = false)
    private User buyer;

    @Column(name = "offered_price", nullable = false, precision = 15, scale = 2)
    private BigDecimal offeredPrice;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ProposalStatus status;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    public Proposal() {
    }

    public Proposal(UUID id, LandLot landLot, User buyer, BigDecimal offeredPrice, String message) {
        this.id = id != null ? id : UUID.randomUUID();
        this.landLot = landLot;
        this.buyer = buyer;
        this.offeredPrice = offeredPrice;
        this.message = message;
        this.status = ProposalStatus.PENDING;
        this.createdAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public LandLot getLandLot() { return landLot; }
    public void setLandLot(LandLot landLot) { this.landLot = landLot; }
    public User getBuyer() { return buyer; }
    public void setBuyer(User buyer) { this.buyer = buyer; }
    public BigDecimal getOfferedPrice() { return offeredPrice; }
    public void setOfferedPrice(BigDecimal offeredPrice) { this.offeredPrice = offeredPrice; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public ProposalStatus getStatus() { return status; }
    public void setStatus(ProposalStatus status) { this.status = status; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
