# pylint: disable=W0621,C0114,C0116,W0212,W0613
from typing import Any
from django.test import Client
import pytest

@pytest.mark.parametrize("current_client", ["admin", "user", "anonymous"])
def test_annotator_types(
    current_client: str, clients: dict[str, Client],
) -> None:
    client = clients[current_client]

    response = client.get("/api/editor/annotator_types")

    assert response.status_code == 200
    assert set(response.json()) == {
        "allele_score",
        "np_score",
        "position_score",
        "effect_annotator",
        "gene_set_annotator",
        "liftover_annotator",
        "basic_liftover_annotator",
        "bcf_liftover_annotator",
        "normalize_allele_annotator",
        "gene_score_annotator",
        "simple_effect_annotator",
        "cnv_collection",
        "chrom_mapping",
        "debug_annotator",
    }


@pytest.mark.parametrize("current_client", ["admin", "user", "anonymous"])
@pytest.mark.parametrize("annotator_type,extra_parameters,expected", [
    (
        "position_score",
        {},
        {
            "annotator_type": "position_score",
            "resource_id": {
                "field_type": "resource",
                "resource_type": "position_score",
            },
            "input_annotatable": {
                "field_type": "string",
            },
        },
    ),
])
def test_annotator_config(
    current_client: str, clients: dict[str, Client],
    annotator_type: str, extra_parameters: dict[str, Any],
    expected: dict[str, Any],
) -> None:
    client = clients[current_client]

    response = client.post("/api/editor/annotator_config", data={
        "annotator_type": annotator_type,
        **extra_parameters,
    })

    assert response.status_code == 200
    config = response.json()
    assert config == expected


@pytest.mark.parametrize("current_client", ["admin", "user", "anonymous"])
def test_annotator_attributes(
    current_client: str, clients: dict[str, Client],
) -> None:
    client = clients[current_client]

    response = client.post("/api/editor/annotator_attributes", data={
        "annotator_type": "position_score",
        "resource_id": "scores/pos1",
    }, content_type="application/json")

    assert response.status_code == 400
    error = response.json()
    assert error == {"error": "annotator_type is required"}
