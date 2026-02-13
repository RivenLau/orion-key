package com.orionkey.repository;

import com.orionkey.entity.PaymentChannel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentChannelRepository extends JpaRepository<PaymentChannel, UUID> {

    List<PaymentChannel> findByIsDeletedOrderBySortOrderAsc(int isDeleted);

    Optional<PaymentChannel> findByChannelCodeAndIsDeleted(String channelCode, int isDeleted);
}
