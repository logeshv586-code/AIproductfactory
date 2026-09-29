"""Offline-first capability library for AI Product Factory."""

from .offline_catalog import (
    OFFLINE_CAPABILITIES,
    capability_by_id,
    list_offline_capabilities,
    resolve_capabilities,
)
from .offline_policy import (
    OfflineNetworkBlocked,
    factory_offline_only,
    network_allowed,
)
from .online_extensions import (
    ONLINE_EXTENSIONS,
    list_online_extensions,
    match_online_extensions,
)
from .product_blueprints import (
    PRODUCT_BLUEPRINTS,
    blueprint_by_id,
    match_product_blueprints,
)

__all__ = [
    "OFFLINE_CAPABILITIES",
    "ONLINE_EXTENSIONS",
    "PRODUCT_BLUEPRINTS",
    "OfflineNetworkBlocked",
    "blueprint_by_id",
    "capability_by_id",
    "factory_offline_only",
    "list_offline_capabilities",
    "list_online_extensions",
    "match_online_extensions",
    "match_product_blueprints",
    "network_allowed",
    "resolve_capabilities",
]
