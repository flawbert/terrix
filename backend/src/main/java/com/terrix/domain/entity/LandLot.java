package com.terrix.domain.entity;

import com.terrix.domain.enums.LandStatus;
import jakarta.persistence.*;
import org.locationtech.jts.geom.Polygon;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "land_lots")
public class LandLot {

    @Id
    private UUID id;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal price;

    @Column(name = "area_sq_meters", nullable = false)
    private Double areaSqMeters;

    @Column(name = "contact_info", nullable = false, length = 150)
    private String contactInfo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private LandStatus status;

    @Column(nullable = false, columnDefinition = "geometry(Polygon,4326)")
    private Polygon geometry;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public LandLot() {
    }

    public LandLot(UUID id, String title, String description, BigDecimal price,
                   Double areaSqMeters, String contactInfo, LandStatus status,
                   Polygon geometry, User owner) {
        this.id = id != null ? id : UUID.randomUUID();
        this.title = title;
        this.description = description;
        this.price = price;
        this.areaSqMeters = areaSqMeters;
        this.contactInfo = contactInfo;
        this.status = status != null ? status : LandStatus.AVAILABLE;
        this.geometry = geometry;
        this.owner = owner;
        this.createdAt = OffsetDateTime.now();
        this.updatedAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
    public Double getAreaSqMeters() { return areaSqMeters; }
    public void setAreaSqMeters(Double areaSqMeters) { this.areaSqMeters = areaSqMeters; }
    public String getContactInfo() { return contactInfo; }
    public void setContactInfo(String contactInfo) { this.contactInfo = contactInfo; }
    public LandStatus getStatus() { return status; }
    public void setStatus(LandStatus status) { this.status = status; }
    public Polygon getGeometry() { return geometry; }
    public void setGeometry(Polygon geometry) { this.geometry = geometry; }
    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
