package com.terrix.domain.repository;

import com.terrix.domain.entity.LandLot;
import org.locationtech.jts.geom.Polygon;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public interface LandLotRepository extends JpaRepository<LandLot, UUID> {

    @Query("SELECT l FROM LandLot l JOIN FETCH l.owner ORDER BY l.createdAt DESC")
    List<LandLot> findAllWithOwner();

    @Query(value = """
            SELECT EXISTS (
                SELECT 1 FROM land_lots l
                WHERE ST_Intersects(l.geometry, :candidateGeometry)
                  AND NOT ST_Touches(l.geometry, :candidateGeometry)
                  AND ST_Area(CAST(ST_Intersection(l.geometry, :candidateGeometry) AS geography)) > 0.5
            )
            """, nativeQuery = true)
    boolean existsOverlappingLand(@Param("candidateGeometry") Polygon candidateGeometry);

    @Query(value = "SELECT ST_Area(CAST(:polygon AS geography))", nativeQuery = true)
    Double calculateGeodesicAreaSqMeters(@Param("polygon") Polygon polygon);

    @Query(value = """
            SELECT l.* FROM land_lots l
            WHERE ST_DWithin(
                CAST(l.geometry AS geography),
                CAST(ST_SetSRID(ST_MakePoint(:centerLon, :centerLat), 4326) AS geography),
                :radiusInMeters
            )
            AND (:maxPrice IS NULL OR l.price <= :maxPrice)
            AND (:status IS NULL OR l.status = :status)
            ORDER BY l.created_at DESC
            """, nativeQuery = true)
    List<LandLot> searchWithinCircle(
            @Param("centerLon") double centerLon,
            @Param("centerLat") double centerLat,
            @Param("radiusInMeters") double radiusInMeters,
            @Param("maxPrice") BigDecimal maxPrice,
            @Param("status") String status
    );
}
