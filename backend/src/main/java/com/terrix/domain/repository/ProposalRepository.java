package com.terrix.domain.repository;

import com.terrix.domain.entity.Proposal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ProposalRepository extends JpaRepository<Proposal, UUID> {

    @Query("SELECT p FROM Proposal p JOIN FETCH p.buyer JOIN FETCH p.landLot WHERE p.landLot.id = :landLotId ORDER BY p.createdAt DESC")
    List<Proposal> findByLandLotIdWithDetails(@Param("landLotId") UUID landLotId);

    @Query("SELECT p FROM Proposal p JOIN FETCH p.buyer JOIN FETCH p.landLot l JOIN FETCH l.owner WHERE l.owner.id = :ownerId ORDER BY p.createdAt DESC")
    List<Proposal> findReceivedProposalsByOwnerId(@Param("ownerId") UUID ownerId);
}
