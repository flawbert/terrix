package com.terrix.controller;

import com.terrix.domain.enums.LandStatus;
import com.terrix.dto.request.CreateLandLotRequest;
import com.terrix.dto.response.LandLotResponse;
import com.terrix.service.LandLotService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/lands")
public class LandLotController {

    private final LandLotService landLotService;

    public LandLotController(LandLotService landLotService) {
        this.landLotService = landLotService;
    }

    @PostMapping
    public ResponseEntity<LandLotResponse> createLandLot(
            @Valid @RequestBody CreateLandLotRequest request,
            Authentication authentication) {
        String email = authentication != null ? authentication.getName() : null;
        LandLotResponse created = landLotService.createLandLot(request, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping
    public ResponseEntity<List<LandLotResponse>> listAllLandLots() {
        return ResponseEntity.ok(landLotService.listAllLandLots());
    }

    @GetMapping("/{id}")
    public ResponseEntity<LandLotResponse> getLandLotById(@PathVariable UUID id) {
        return ResponseEntity.ok(landLotService.getLandLotById(id));
    }

    @GetMapping("/search/circle")
    public ResponseEntity<List<LandLotResponse>> searchByCircle(
            @RequestParam double centerLon,
            @RequestParam double centerLat,
            @RequestParam double radiusMeters,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) LandStatus status) {
        return ResponseEntity.ok(
                landLotService.searchByCircle(centerLon, centerLat, radiusMeters, maxPrice, status)
        );
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<LandLotResponse> updateLandStatus(
            @PathVariable UUID id,
            @RequestParam LandStatus status,
            Authentication authentication) {
        String email = authentication != null ? authentication.getName() : "";
        return ResponseEntity.ok(landLotService.updateLandStatus(id, status, email));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLandLot(@PathVariable UUID id, Authentication authentication) {
        String email = authentication != null ? authentication.getName() : "";
        landLotService.deleteLandLot(id, email);
        return ResponseEntity.noContent().build();
    }
}
