# pylint: disable=W0621,C0114,C0116,W0212,W0613
from types import SimpleNamespace

from pytest_mock import MockerFixture

from dae.annotation.annotation_config import AttributeInfo
from dae.genomic_resources.repository import GenomicResourceRepo
from web_annotation.views import SingleAnnotation


class DummyResource:
    def __init__(self, resource_id: str) -> None:
        self.resource_id = resource_id

    def get_type(self) -> str:
        return "gene_score"


class DummyRepo:
    def __init__(self, resource: DummyResource) -> None:
        self._resource = resource

    def get_resource(self, resource_id: str) -> DummyResource:
        assert resource_id == self._resource.resource_id
        return self._resource


def test_build_attribute_description_with_histogram(
    mocker: MockerFixture,
    test_grr: GenomicResourceRepo,
) -> None:
    view = SingleAnnotation()
    resource = DummyResource("dummy_resource")
    setattr(view, "_grr", DummyRepo(resource))

    attribute_info = AttributeInfo(
        "attr_name",
        "score_id",
        internal=False,
        parameters={},
        _type="str",
        description="desc",
    )

    result = {"attr_name": 123}
    annotator = SimpleNamespace(resource_ids={"dummy_resource"})

    histogram_mock = mocker.patch(
        "web_annotation.views.has_histogram",
        return_value=True,
    )
    help_mock = mocker.patch.object(
        view,
        "generate_annotator_help",
        return_value="help",
    )

    description = view._build_attribute_description(
        result,
        annotator,
        attribute_info,
    )

    histogram_mock.assert_called_once_with(resource, "score_id")
    help_mock.assert_called_once_with(annotator, attribute_info)

    assert description["name"] == "attr_name"
    assert description["description"] == "desc"
    assert description["help"] == "help"
    assert description["source"] == "score_id"
    assert description["type"] == "str"
    expected_histogram = "histograms/dummy_resource?score_id=score_id"
    assert description["result"]["histogram"] == expected_histogram
    assert description["result"]["value"] == 123


def test_build_attribute_description_stringifies_non_mapping_objects(
    mocker: MockerFixture,
) -> None:
    view = SingleAnnotation()
    resource = DummyResource("dummy_resource")
    setattr(view, "_grr", DummyRepo(resource))

    attribute_info = AttributeInfo(
        "attr_name",
        "score_id",
        internal=False,
        parameters={},
        _type="object",
    )

    result = {"attr_name": 456}
    annotator = SimpleNamespace(resource_ids={"dummy_resource"})

    mocker.patch(
        "web_annotation.views.has_histogram",
        return_value=False,
    )
    mocker.patch.object(view, "generate_annotator_help", return_value=None)

    description = view._build_attribute_description(
        result,
        annotator,
        attribute_info,
    )

    assert description["result"]["histogram"] is None
    assert description["result"]["value"] == "456"
