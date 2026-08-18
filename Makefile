.PHONY: test compile verify run stop logs

test:
	PYTHONPATH=backend python3 -m unittest discover -s backend/tests -v

compile:
	python3 -m compileall -q backend/app backend/tests

verify: test compile

run:
	docker compose up --build -d

stop:
	docker compose down

logs:
	docker compose logs -f --tail=100
