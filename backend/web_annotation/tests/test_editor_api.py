# pylint: disable=W0621,C0114,C0116,W0212,W0613
from typing import Any
import yaml
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
        "position_score",
        "effect_annotator",
        "gene_set_annotator",
        "liftover_annotator",
        "normalize_allele_annotator",
        "gene_score_annotator",
        "simple_effect_annotator",
        "cnv_collection",
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
    (
        "gene_set_annotator",
        {},
        {
            "annotator_type": "gene_set_annotator",
            "resource_id": {
                "field_type": "resource",
                "resource_type": "gene_set_collection",
            },
            "input_gene_list": {
                "field_type": "string",
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
    }, content_type="application/json")

    assert response.status_code == 200
    config = response.json()
    assert config == expected


@pytest.mark.parametrize("current_client", ["admin", "user", "anonymous"])
def test_annotator_attributes_position_score(
    current_client: str, clients: dict[str, Client],
) -> None:
    client = clients[current_client]

    response = client.post("/api/editor/annotator_attributes", data={
        "annotator_type": "position_score",
        "resource_id": "scores/pos1",
        "pipeline_id": "pipeline/test_pipeline",
    }, content_type="application/json")

    assert response.status_code == 200
    attributes = response.json()
    assert len(attributes) == 1
    assert attributes[0] == {
        "name": "pos1",
        "source": "pos1",
        "type": "float",
        "default": True,
        "internal": False,
    }


@pytest.mark.parametrize("current_client", ["admin", "user", "anonymous"])
def test_annotator_attributes_cnv_collection(
    current_client: str, clients: dict[str, Client],
) -> None:
    client = clients[current_client]

    response = client.post("/api/editor/annotator_attributes", data={
        "annotator_type": "cnv_collection",
        "resource_id": "cnv_collections/test_collection",
        "pipeline_id": "pipeline/test_pipeline",
    }, content_type="application/json")

    assert response.status_code == 200
    attributes = response.json()
    assert len(attributes) == 1
    assert attributes[0] == {
        "name": "count",
        "source": "count",
        "type": "int",
        "default": True,
        "internal": False,
    }


@pytest.mark.parametrize("current_client", ["admin", "user", "anonymous"])
def test_effect_annotator_attributes(
    current_client: str, clients: dict[str, Client],
) -> None:
    client = clients[current_client]

    response = client.post("/api/editor/annotator_attributes", data={
        "annotator_type": "effect_annotator",
        "genome": "t4c8/t4c8_genome",
        "gene_models": "t4c8/t4c8_genes",
        "pipeline_id": "pipeline/test_pipeline",
    }, content_type="application/json")

    assert response.status_code == 200
    response_data = response.json()
    assert len(response_data) == 61
    attr_names = [attr["name"] for attr in response_data]

    assert "worst_effect" in attr_names
    assert "worst_effect_genes" in attr_names
    assert "gene_effects" in attr_names
    assert "effect_details" in attr_names
    assert "gene_list" in attr_names


@pytest.mark.parametrize("current_client", ["admin", "user", "anonymous"])
def test_annotator_yaml_position_score(
    current_client: str, clients: dict[str, Client],
) -> None:
    client = clients[current_client]

    response = client.post("/api/editor/annotator_yaml", data={
        "annotator_type": "position_score",
        "resource_id": "scores/pos1",
        "attributes": [
            {
                "name": "pos1",
                "source": "pos1",
                "internal": False,
            }
        ]
    }, content_type="application/json")

    assert response.status_code == 200
    yaml_output = response.json()

    output = yaml.safe_load(yaml_output)
    assert output == [{
        "position_score": {
            "resource_id": "scores/pos1",
            "attributes": [
                {
                    "name": "pos1",
                    "source": "pos1",
                    "internal": False,
                }
            ],
        }
    }]


@pytest.mark.parametrize("current_client", ["admin", "user", "anonymous"])
def test_annotator_creation_workflow(
    current_client: str, clients: dict[str, Client],
) -> None:
    client = clients[current_client]

    # Step 1: Get annotator types
    response = client.get("/api/editor/annotator_types")
    assert response.status_code == 200
    annotator_types = response.json()
    assert "position_score" in annotator_types

    # Step 2: Get annotator config
    response = client.post("/api/editor/annotator_config", data={
        "annotator_type": "position_score",
    }, content_type="application/json")
    assert response.status_code == 200
    config = response.json()
    assert config == {
        "annotator_type": "position_score",
        "resource_id": {
            "field_type": "resource",
            "resource_type": "position_score",
            "optional": False,
        },
        "input_annotatable": {
            "field_type": "string",
            "optional": True,
        },
    }
    assert config["annotator_type"] == "position_score"

    # Step 3: Get position scores

    response = client.get("/api/resources?type=position_score")
    assert response.status_code == 200
    resources = response.json()
    assert "scores/pos1" in resources

    # Step 4: Get annotator attributes
    response = client.post("/api/editor/annotator_attributes", data={
        "annotator_type": "position_score",
        "resource_id": "scores/pos1",
        "pipeline_id": "pipeline/test_pipeline",
    }, content_type="application/json")
    assert response.status_code == 200
    attributes = response.json()
    assert len(attributes) == 1
    assert attributes[0]["name"] == "pos1"
    attributes[0]["name"] = "pos1_score"

    # Step 5: Get annotator YAML
    response = client.post("/api/editor/annotator_yaml", data={
        "annotator_type": "position_score",
        "resource_id": "scores/pos1",
        "attributes": attributes,
    }, content_type="application/json")
    assert response.status_code == 200
    yaml_output = response.json()

    output = yaml.safe_load(yaml_output)
    expected = [{
        "position_score": {
            "resource_id": "scores/pos1",
            "attributes": [
                {
                    "name": "pos1_score",
                    "source": "pos1",
                    "internal": False,
                    "default": True,
                }
            ],
        }
    }]
    assert output == expected


@pytest.mark.parametrize("current_client", ["admin", "user", "anonymous"])
def test_annotator_creation_resource_workflow(
    current_client: str, clients: dict[str, Client],
) -> None:
    client = clients[current_client]

    # Step 1: Get resource types
    response = client.get("/api/resources/types")
    assert response.status_code == 200
    assert "position_score" in response.json()

    # Step 2: Get resources of type position_score
    response = client.get("/api/resources?type=position_score")
    assert response.status_code == 200

    assert "scores/pos1" in response.json()

    # Step 3: Get available annotators for the resource
    response = client.get("/api/editor/resource_annotators", query_params={
        "resource_id": "scores/pos1",
    }, content_type="application/json")
    assert response.status_code == 200
    annotators = response.json()
    assert len(annotators) == 1
    assert annotators[0]["annotator_type"] == "position_score"
    assert annotators[0]["resource_id"] == "scores/pos1"

    # Step 4: Get annotator config
    response = client.post(
        "/api/editor/annotator_config",
        data=annotators[0],
        content_type="application/json",
    )
    assert response.status_code == 200
    config = response.json()
    assert config["annotator_type"] == "position_score"
    assert config["resource_id"]["value"] == "scores/pos1"

    # Step 5: Get annotator attributes
    response = client.post("/api/editor/annotator_attributes", data={
        "annotator_type": "position_score",
        "resource_id": "scores/pos1",
        "pipeline_id": "pipeline/test_pipeline",
    }, content_type="application/json")
    assert response.status_code == 200
    attributes = response.json()
    assert len(attributes) == 1
    assert attributes[0]["name"] == "pos1"
    attributes[0]["name"] = "pos1_score"

    # Step 6: Get annotator YAML
    response = client.post("/api/editor/annotator_yaml", data={
        "annotator_type": "position_score",
        "resource_id": "scores/pos1",
        "attributes": attributes,
    }, content_type="application/json")
    assert response.status_code == 200
    yaml_output = response.json()

    output = yaml.safe_load(yaml_output)
    expected = [{
        "position_score": {
            "resource_id": "scores/pos1",
            "attributes": [
                {
                    "name": "pos1_score",
                    "source": "pos1",
                    "internal": False,
                    "default": True,
                }
            ],
        }
    }]
    assert output == expected
